import time
import logging
from typing import List, Optional, Tuple
import numpy as np
from fastapi import APIRouter, File, UploadFile, Request, HTTPException, status
from fastapi.concurrency import run_in_threadpool

from app.schemas.detection import (
    UnifiedAnalysisResponse,
    DetectedPerson,
    DetectedFace,
    Base64DetectRequest,
)
from app.core.image import read_image_bytes_to_cv2, decode_base64_to_cv2
from app.core.quality import calculate_face_quality_score, assess_face_quality
from app.core.insightface import inference_semaphore

router = APIRouter()
logger = logging.getLogger("intelliguard.analyze")


def _match_primary_face(
    faces: list,
    primary_person_bbox: Optional[List[float]],
) -> Optional[Tuple[any, List[float]]]:
    """Select the primary face corresponding to the primary person or highest confidence face."""
    if not faces:
        return None

    best_face = None
    best_score = -1.0
    best_bbox = []

    # First attempt: find highest confidence face inside primary person bounding box
    if primary_person_bbox and len(primary_person_bbox) == 4:
        px1, py1, px2, py2 = primary_person_bbox
        for face in faces:
            fb = [round(float(c), 2) for c in face.bbox] if hasattr(face, "bbox") else []
            if len(fb) == 4:
                fc_x = (fb[0] + fb[2]) / 2.0
                fc_y = (fb[1] + fb[3]) / 2.0
                if px1 <= fc_x <= px2 and py1 <= fc_y <= py2:
                    score = float(face.det_score) if hasattr(face, "det_score") else 0.0
                    if score > best_score:
                        best_score = score
                        best_face = face
                        best_bbox = fb

    # Fallback: take highest confidence face across entire image
    if best_face is None:
        for face in faces:
            fb = [round(float(c), 2) for c in face.bbox] if hasattr(face, "bbox") else []
            score = float(face.det_score) if hasattr(face, "det_score") else 0.0
            if score > best_score:
                best_score = score
                best_face = face
                best_bbox = fb

    return (best_face, best_bbox) if best_face is not None else None


def _format_detected_faces(faces: list) -> List[DetectedFace]:
    """Format InsightFace face objects into DetectedFace schema items."""
    formatted = []
    for face in faces:
        bbox = [round(float(c), 2) for c in face.bbox] if hasattr(face, "bbox") else []
        conf = round(float(face.det_score), 4) if hasattr(face, "det_score") else 0.0
        landmarks = None
        if hasattr(face, "kps") and face.kps is not None:
            landmarks = [[round(float(pt[0]), 2), round(float(pt[1]), 2)] for pt in face.kps]
        formatted.append(DetectedFace(bbox=bbox, confidence=conf, landmarks=landmarks))
    return formatted


def _extract_embedding_vector(face) -> Optional[List[float]]:
    """Extract L2-normalized 512D ArcFace embedding vector from face object."""
    raw_emb = None
    if hasattr(face, "normed_embedding") and face.normed_embedding is not None:
        raw_emb = face.normed_embedding
    elif hasattr(face, "embedding") and face.embedding is not None:
        raw_emb = face.embedding

    if raw_emb is None or len(raw_emb) != 512:
        return None

    l2_norm = float(np.linalg.norm(raw_emb))
    if l2_norm <= 0:
        return None

    norm_vec = raw_emb / l2_norm
    return [round(float(v), 6) for v in norm_vec]


async def _execute_analysis(
    img: np.ndarray,
    yolo_detector,
    insightface_app,
    model_name: str,
) -> UnifiedAnalysisResponse:
    """Execute the multi-stage computer vision pipeline on an OpenCV BGR image."""
    start_time = time.perf_counter()
    img_h, img_w = img.shape[:2]

    # Stage 1: YOLO Person Detection (CPU inference protected by concurrency semaphore)
    t_yolo_start = time.perf_counter()
    async with inference_semaphore:
        persons_raw = await run_in_threadpool(yolo_detector.detect, img)
    yolo_time_ms = round((time.perf_counter() - t_yolo_start) * 1000, 2)

    persons: List[DetectedPerson] = [
        DetectedPerson(
            bbox=p.bbox,
            confidence=p.confidence,
            is_primary=p.is_primary,
        )
        for p in persons_raw
    ]

    # 1. State: No Person Detected
    if len(persons) == 0:
        total_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.info(f"Analysis complete: 0 persons found in {total_time_ms} ms (YOLO: {yolo_time_ms} ms).")
        return UnifiedAnalysisResponse(
            success=True,
            status="no_person",
            person_detected=False,
            face_detected=False,
            person_count=0,
            face_count=0,
            persons=[],
            faces=[],
            primary_person_bbox=None,
            primary_face_bbox=None,
            embedding=None,
            embedding_size=None,
            quality_score=None,
            detection_confidence=None,
            model=model_name,
            image_width=img_w,
            image_height=img_h,
            message="No person detected in the camera frame.",
            execution_time_ms=total_time_ms,
            yolo_time_ms=yolo_time_ms,
            insightface_time_ms=0.0,
        )

    primary_person = next((p for p in persons if p.is_primary), persons[0])

    # Stage 2: InsightFace Face Detection (Only executed because a person is visible)
    t_face_start = time.perf_counter()
    async with inference_semaphore:
        faces_raw = await run_in_threadpool(insightface_app.get, img)
    insightface_time_ms = round((time.perf_counter() - t_face_start) * 1000, 2)

    detected_faces = _format_detected_faces(faces_raw)

    # 2. State: Person Detected, No Face Detected
    if len(detected_faces) == 0:
        total_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.info(
            f"Analysis complete: {len(persons)} person(s), 0 faces found in {total_time_ms} ms."
        )
        return UnifiedAnalysisResponse(
            success=True,
            status="person_no_face",
            person_detected=True,
            face_detected=False,
            person_count=len(persons),
            face_count=0,
            persons=persons,
            faces=[],
            primary_person_bbox=primary_person.bbox,
            primary_face_bbox=None,
            embedding=None,
            embedding_size=None,
            quality_score=None,
            detection_confidence=None,
            model=model_name,
            image_width=img_w,
            image_height=img_h,
            message="Person detected — no face visible in the frame.",
            execution_time_ms=total_time_ms,
            yolo_time_ms=yolo_time_ms,
            insightface_time_ms=insightface_time_ms,
        )

    # Match primary face to primary person
    match_result = _match_primary_face(faces_raw, primary_person.bbox)
    primary_face_raw, primary_face_bbox = match_result if match_result else (faces_raw[0], detected_faces[0].bbox)

    assessment = assess_face_quality(img, primary_face_raw)
    face_conf = assessment.detection_confidence
    quality_score = assessment.quality_score

    # 3. State: Face Detected — Low Quality (Quality score < 0.45 or detection score < 0.45)
    # Allows reasonable webcam variation while preventing blurred, dark, or profile images from entering pgvector matching
    if face_conf < 0.45 or quality_score < 0.45 or assessment.is_blurry or assessment.is_underexposed:
        total_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        guidance_msg = (
            f"Face detected with low quality: {assessment.guidance}"
            if assessment.guidance
            else "Face detected with low quality or obstruction. Please face the camera directly in good lighting."
        )
        logger.info(
            f"Analysis complete: Low quality face detected (quality={quality_score}, det_score={face_conf}, issues={assessment.issues})."
        )
        return UnifiedAnalysisResponse(
            success=True,
            status="face_low_quality",
            person_detected=True,
            face_detected=True,
            person_count=len(persons),
            face_count=len(detected_faces),
            persons=persons,
            faces=detected_faces,
            primary_person_bbox=primary_person.bbox,
            primary_face_bbox=primary_face_bbox,
            embedding=None,
            embedding_size=None,
            quality_score=quality_score,
            detection_confidence=face_conf,
            model=model_name,
            image_width=img_w,
            image_height=img_h,
            message=guidance_msg,
            execution_time_ms=total_time_ms,
            yolo_time_ms=yolo_time_ms,
            insightface_time_ms=insightface_time_ms,
        )

    # Stage 3: Extract 512D ArcFace Biometric Embedding Vector
    embedding_vec = _extract_embedding_vector(primary_face_raw)
    total_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

    if embedding_vec is None:
        logger.warning(
            f"Embedding extraction failed for face (quality={quality_score}) in {total_time_ms} ms."
        )
        return UnifiedAnalysisResponse(
            success=False,
            status="recognition_error",
            person_detected=True,
            face_detected=True,
            person_count=len(persons),
            face_count=len(detected_faces),
            persons=persons,
            faces=detected_faces,
            primary_person_bbox=primary_person.bbox,
            primary_face_bbox=primary_face_bbox,
            embedding=None,
            embedding_size=None,
            quality_score=quality_score,
            detection_confidence=face_conf,
            model=model_name,
            image_width=img_w,
            image_height=img_h,
            message="Face detected, but biometric embedding extraction failed.",
            execution_time_ms=total_time_ms,
            yolo_time_ms=yolo_time_ms,
            insightface_time_ms=insightface_time_ms,
        )

    logger.info(
        f"Analysis complete: Usable face processed (quality={quality_score}) in {total_time_ms} ms."
    )

    return UnifiedAnalysisResponse(
        success=True,
        status="face_detected_processing",
        person_detected=True,
        face_detected=True,
        person_count=len(persons),
        face_count=len(detected_faces),
        persons=persons,
        faces=detected_faces,
        primary_person_bbox=primary_person.bbox,
        primary_face_bbox=primary_face_bbox,
        embedding=embedding_vec,
        embedding_size=512,
        quality_score=quality_score,
        detection_confidence=face_conf,
        model=model_name,
        image_width=img_w,
        image_height=img_h,
        message="Face detected and biometric vector extracted successfully.",
        execution_time_ms=total_time_ms,
        yolo_time_ms=yolo_time_ms,
        insightface_time_ms=insightface_time_ms,
    )


@router.post(
    "/analyze",
    response_model=UnifiedAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Unified person detection, face detection, and embedding analysis",
    description="Accepts an image file upload and executes single-pass YOLO person detection, InsightFace face detection, and embedding extraction.",
)
async def analyze_image_file(
    request: Request,
    file: UploadFile = File(..., description="Image file to analyze"),
) -> UnifiedAnalysisResponse:
    manager = getattr(request.app.state, "insightface_manager", None)
    face_app = getattr(request.app.state, "insightface_app", None)
    yolo = getattr(request.app.state, "yolo_detector", None)

    if manager is None or not manager.is_loaded or face_app is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Face analysis service is unavailable. InsightFace model is not loaded.",
        )
    if yolo is None or not yolo.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Person detection service is unavailable. YOLO model is not loaded.",
        )

    if file.content_type and file.content_type != "application/octet-stream" and not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File provided must be an image (received: {file.content_type})",
        )

    image_bytes = await file.read()
    img = read_image_bytes_to_cv2(image_bytes)

    return await _execute_analysis(img, yolo, face_app, manager.model_name)


@router.post(
    "/analyze/base64",
    response_model=UnifiedAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Unified analysis from base64-encoded image",
    description="Accepts a base64 encoded image string and returns unified person and face analysis details.",
)
async def analyze_image_base64(
    request: Request,
    payload: Base64DetectRequest,
) -> UnifiedAnalysisResponse:
    manager = getattr(request.app.state, "insightface_manager", None)
    face_app = getattr(request.app.state, "insightface_app", None)
    yolo = getattr(request.app.state, "yolo_detector", None)

    if manager is None or not manager.is_loaded or face_app is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Face analysis service is unavailable. InsightFace model is not loaded.",
        )
    if yolo is None or not yolo.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Person detection service is unavailable. YOLO model is not loaded.",
        )

    img = decode_base64_to_cv2(payload.image_base64)
    return await _execute_analysis(img, yolo, face_app, manager.model_name)

