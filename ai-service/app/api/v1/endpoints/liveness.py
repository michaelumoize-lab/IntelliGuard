import time
import logging
from typing import Optional, List
import numpy as np
from fastapi import APIRouter, File, UploadFile, Request, HTTPException, status
from fastapi.concurrency import run_in_threadpool

from app.schemas.detection import LivenessInspectionResponse, LivenessDetail, Base64DetectRequest
from app.core.image import read_image_bytes_to_cv2, decode_base64_to_cv2
from app.core.config import settings
from app.core.insightface import inference_semaphore

router = APIRouter()
logger = logging.getLogger("intelliguard.liveness")


def _get_guidance_message(liveness_status: str, live_score: float) -> str:
    if liveness_status == "live":
        return "Bona fide presentation verified. Face is confirmed live and eligible for identity matching."
    elif liveness_status == "spoof_detected":
        return "Presentation attack detected. Electronic display replay or printed photo suspected. Access denied."
    elif liveness_status == "inconclusive":
        return "Liveness check inconclusive. Please face the camera directly, avoid screen backlight, and retry."
    else:
        return "Anti-spoofing evaluation encountered a technical failure. Please retry."


async def _inspect_liveness(
    img: np.ndarray,
    face_app,
    antispoof_manager,
    model_name: str,
) -> LivenessInspectionResponse:
    start_time = time.perf_counter()

    if face_app is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Face detection service is unavailable.",
        )
    if antispoof_manager is None or not antispoof_manager.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Anti-spoofing dual-model engine is unavailable or failed to initialize.",
        )

    # 1. Run face detection to locate face bounding box
    async with inference_semaphore:
        faces = await run_in_threadpool(face_app.get, img)

    if not faces or len(faces) == 0:
        total_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return LivenessInspectionResponse(
            success=False,
            face_detected=False,
            bbox=None,
            detection_confidence=None,
            liveness=None,
            active_recognition_model=model_name,
            guidance="No face detected in the image. Please position your face clearly in the frame.",
            execution_time_ms=total_time_ms,
        )

    # Select primary face (highest confidence)
    best_face = max(faces, key=lambda f: getattr(f, "det_score", 0.0))
    bbox = [round(float(c), 2) for c in best_face.bbox] if hasattr(best_face, "bbox") else [0.0, 0.0, 0.0, 0.0]
    conf = round(float(best_face.det_score), 4) if hasattr(best_face, "det_score") else 0.0

    # 2. Run dual-model anti-spoofing on original BGR image crop
    async with inference_semaphore:
        liveness_res = await run_in_threadpool(
            antispoof_manager.predict_liveness,
            img,
            bbox,
        )

    total_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

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
        error_message=liveness_res.error_message,
    )

    guidance = _get_guidance_message(liveness_res.status, liveness_res.live_score)

    return LivenessInspectionResponse(
        success=liveness_res.status != "error",
        face_detected=True,
        bbox=bbox,
        primary_face_bbox=bbox,
        detection_confidence=conf,
        liveness=liveness_detail,
        active_recognition_model=model_name,
        guidance=guidance,
        execution_time_ms=total_time_ms,
    )


@router.post(
    "/liveness",
    response_model=LivenessInspectionResponse,
    status_code=status.HTTP_200_OK,
    summary="Direct anti-spoofing inspection from image upload",
    description="Inspects an image upload with MiniFASNetV2 and MiniFASNetV1SE dual models, reporting bona fide probability and presentation attack status.",
)
async def inspect_liveness_file(
    request: Request,
    file: UploadFile = File(..., description="Image file to inspect for liveness"),
) -> LivenessInspectionResponse:
    manager = getattr(request.app.state, "insightface_manager", None)
    face_app = getattr(request.app.state, "insightface_app", None)
    antispoof = getattr(request.app.state, "antispoof_manager", None)

    if file.content_type and file.content_type != "application/octet-stream" and not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File provided must be an image (received: {file.content_type})",
        )

    image_bytes = await file.read()
    img = read_image_bytes_to_cv2(image_bytes)

    model_name = manager.model_name if manager else settings.INSIGHTFACE_MODEL
    return await _inspect_liveness(img, face_app, antispoof, model_name)


@router.post(
    "/liveness/base64",
    response_model=LivenessInspectionResponse,
    status_code=status.HTTP_200_OK,
    summary="Direct anti-spoofing inspection from base64 image",
    description="Inspects a base64 encoded image with MiniFASNet dual models and reports presentation attack status.",
)
async def inspect_liveness_base64(
    request: Request,
    payload: Base64DetectRequest,
) -> LivenessInspectionResponse:
    manager = getattr(request.app.state, "insightface_manager", None)
    face_app = getattr(request.app.state, "insightface_app", None)
    antispoof = getattr(request.app.state, "antispoof_manager", None)

    img = decode_base64_to_cv2(payload.image_base64)
    model_name = manager.model_name if manager else settings.INSIGHTFACE_MODEL
    return await _inspect_liveness(img, face_app, antispoof, model_name)
