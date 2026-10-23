import time
import logging
import asyncio
import numpy as np
from typing import List, Optional, Tuple
from fastapi import APIRouter, File, UploadFile, Request, Response, HTTPException, status
from fastapi.concurrency import run_in_threadpool

from app.schemas.embedding import FaceEmbeddingResponse, Base64EmbeddingRequest
from app.schemas.detection import LivenessDetail
from app.core.config import settings
from app.core.image import read_image_bytes_to_cv2, decode_base64_to_cv2
from app.core.quality import calculate_face_quality_score, validate_registration_quality
from app.core.insightface import inference_semaphore

router = APIRouter()
logger = logging.getLogger("intelliguard.embedding")


def _extract_512d_embedding(
    img: np.ndarray,
    face_app,
    antispoof_manager=None,
) -> Tuple[List[float], float, float, Optional[LivenessDetail]]:
    """Run detection and recognition inference, validate face count, verify anti-spoofing liveness, and return 512D L2-normalized embedding vector.
    
    Returns:
        tuple of (embedding_list, quality_score, detection_confidence, liveness_detail)
    """
    faces = face_app.get(img)

    # 1. Enforce strict single-face detection rules
    if len(faces) == 0:
        logger.warning("Embedding requested but no face was detected in image.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No face detected in the provided image.",
        )
    elif len(faces) > 1:
        logger.warning(f"Embedding requested but {len(faces)} faces were detected in image.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Multiple faces detected ({len(faces)} faces found). Exactly one face is required for biometric processing. Please ensure only one person is visible.",
        )

    face = faces[0]

    # 2. Quality evaluation & detection confidence with strict registration validation
    is_valid, rejection_reason, assessment = validate_registration_quality(img, face)
    if not is_valid:
        logger.warning(f"Registration embedding rejected due to poor quality: {rejection_reason}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Face image does not meet enrollment quality requirements: {rejection_reason}",
        )

    # 3. Anti-Spoofing / Presentation Attack Detection (fail-closed enrollment check)
    liveness_detail: Optional[LivenessDetail] = None
    if settings.ANTISPOOF_ENABLED and antispoof_manager is not None and getattr(antispoof_manager, "is_loaded", False):
        try:
            x1, y1, x2, y2 = face.bbox
            liveness_res = antispoof_manager.predict(img, [float(x1), float(y1), float(x2), float(y2)])
            liveness_detail = LivenessDetail(
                status=liveness_res.status,
                model=liveness_res.model,
                live_score=liveness_res.live_score,
                threshold=liveness_res.threshold,
                live_threshold=liveness_res.live_threshold,
                spoof_threshold=liveness_res.spoof_threshold,
                individual_scores=liveness_res.individual_scores,
                processing_time_ms=liveness_res.processing_time_ms,
                ensemble_method=liveness_res.ensemble_method,
            )

            if liveness_res.status == "spoof_detected":
                logger.warning(
                    f"Registration embedding rejected: Presentation attack / spoof detected "
                    f"(score={liveness_res.live_score:.4f}, models={liveness_res.individual_scores})"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Face registration rejected: Presentation attack / spoof detected (liveness score: {liveness_res.live_score:.4f}). Only bona fide live faces may be enrolled.",
                )
            elif liveness_res.status == "inconclusive":
                logger.warning(
                    f"Registration embedding rejected: Inconclusive liveness verification "
                    f"(score={liveness_res.live_score:.4f})"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Face registration rejected: Liveness check was inconclusive. Please ensure optimal lighting and look directly into the camera.",
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error during anti-spoofing check in registration: {e}", exc_info=True)
            # If fail-closed rule applies and anti-spoofing threw an unexpected exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Anti-spoofing verification failed during enrollment: {str(e)}",
            )

    # 4. Extract embedding from InsightFace Face object
    raw_embedding = None
    if hasattr(face, "normed_embedding") and face.normed_embedding is not None:
        raw_embedding = face.normed_embedding
    elif hasattr(face, "embedding") and face.embedding is not None:
        raw_embedding = face.embedding

    if raw_embedding is None:
        logger.error("InsightFace face object does not contain embedding data.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to extract facial embedding vector from inference output.",
        )

    # 5. Verify embedding dimension == 512
    if len(raw_embedding) != 512:
        logger.error(f"Invalid embedding size produced: {len(raw_embedding)} (expected 512).")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference model produced an invalid embedding dimension ({len(raw_embedding)} != 512).",
        )

    # 6. Enforce L2 Normalization (||v|| = 1.0)
    l2_norm = float(np.linalg.norm(raw_embedding))
    if l2_norm <= 0:
        logger.error("Zero-norm embedding vector produced by recognition model.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Zero-norm embedding vector produced by model.",
        )

    normalized_vec = raw_embedding / l2_norm
    embedding_list = [round(float(v), 6) for v in normalized_vec]

    return embedding_list, assessment.quality_score, assessment.detection_confidence, liveness_detail


@router.post(
    "/embedding",
    response_model=FaceEmbeddingResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate 512D facial embedding from image upload",
    description="Accepts an image file upload (JPG, PNG, WebP) with exactly one face and returns a 512-dimensional L2-normalized ArcFace embedding vector.",
)
async def generate_embedding(
    request: Request,
    response: Response,
    file: UploadFile = File(..., description="Image file containing exactly one face"),
) -> FaceEmbeddingResponse:
    manager = getattr(request.app.state, "insightface_manager", None)
    face_app = getattr(request.app.state, "insightface_app", None)
    antispoof_manager = getattr(request.app.state, "antispoof_manager", None)

    if manager is None or not manager.is_loaded or face_app is None:
        logger.error("Embedding requested but InsightFace model is not loaded.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Face embedding service is unavailable. Model is not loaded.",
        )

    # Validate content type if available (allow image/* and application/octet-stream for IoT/cURL clients)
    if file.content_type and file.content_type != "application/octet-stream" and not file.content_type.startswith("image/"):
        logger.warning(f"Invalid content-type received: {file.content_type}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File provided must be an image (received: {file.content_type})",
        )

    start_time = time.perf_counter()

    # Read bytes and decode to OpenCV array
    image_bytes = await file.read()
    img = read_image_bytes_to_cv2(image_bytes)

    # Execute detection and embedding pipeline offloaded to worker pool with concurrency limit
    async with inference_semaphore:
        embedding_vector, quality_score, confidence, liveness_detail = await run_in_threadpool(
            _extract_512d_embedding, img, face_app, antispoof_manager
        )
    execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

    logger.info(f"512D embedding generated successfully in {execution_time_ms} ms.")

    return FaceEmbeddingResponse(
        success=True,
        face_detected=True,
        embedding=embedding_vector,
        embedding_size=512,
        normalized=True,
        quality_score=quality_score,
        detection_confidence=confidence,
        model=manager.model_name,
        model_version=None,
        liveness=liveness_detail,
        execution_time_ms=execution_time_ms,
    )


@router.post(
    "/embedding/base64",
    response_model=FaceEmbeddingResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate 512D facial embedding from base64 image",
    description="Accepts a base64 encoded image string containing exactly one face and returns a 512-dimensional L2-normalized embedding vector.",
)
async def generate_embedding_base64(
    request: Request,
    payload: Base64EmbeddingRequest,
) -> FaceEmbeddingResponse:
    manager = getattr(request.app.state, "insightface_manager", None)
    face_app = getattr(request.app.state, "insightface_app", None)
    antispoof_manager = getattr(request.app.state, "antispoof_manager", None)

    if manager is None or not manager.is_loaded or face_app is None:
        logger.error("Embedding requested but InsightFace model is not loaded.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Face embedding service is unavailable. Model is not loaded.",
        )

    start_time = time.perf_counter()

    # Decode base64 string to OpenCV array
    img = decode_base64_to_cv2(payload.image_base64)

    # Execute detection and embedding pipeline offloaded to worker pool with concurrency limit
    async with inference_semaphore:
        embedding_vector, quality_score, confidence, liveness_detail = await run_in_threadpool(
            _extract_512d_embedding, img, face_app, antispoof_manager
        )
    execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

    logger.info(f"Base64 512D embedding generated successfully in {execution_time_ms} ms.")

    return FaceEmbeddingResponse(
        success=True,
        face_detected=True,
        embedding=embedding_vector,
        embedding_size=512,
        normalized=True,
        quality_score=quality_score,
        detection_confidence=confidence,
        model=manager.model_name,
        model_version=None,
        liveness=liveness_detail,
        execution_time_ms=execution_time_ms,
    )

