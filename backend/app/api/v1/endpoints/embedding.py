import time
import logging
import asyncio
import numpy as np
from typing import List
from fastapi import APIRouter, File, UploadFile, Request, Response, HTTPException, status
from fastapi.concurrency import run_in_threadpool

from app.schemas.embedding import FaceEmbeddingResponse, Base64EmbeddingRequest
from app.core.image import read_image_bytes_to_cv2, decode_base64_to_cv2
from app.core.quality import calculate_face_quality_score

router = APIRouter()
logger = logging.getLogger("intelliguard.embedding")

# Model-safe concurrency limiter to prevent unbounded CPU/GPU model executions
inference_semaphore = asyncio.Semaphore(4)


def _extract_512d_embedding(img: np.ndarray, face_app) -> tuple[List[float], float, float]:
    """Run detection and recognition inference, validate face count, and return 512D L2-normalized embedding vector.
    
    Returns:
        tuple of (embedding_list, quality_score, detection_confidence)
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

    # 2. Extract embedding from InsightFace Face object
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

    # 3. Verify embedding dimension == 512
    if len(raw_embedding) != 512:
        logger.error(f"Invalid embedding size produced: {len(raw_embedding)} (expected 512).")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference model produced an invalid embedding dimension ({len(raw_embedding)} != 512).",
        )

    # 4. Enforce L2 Normalization (||v|| = 1.0)
    l2_norm = float(np.linalg.norm(raw_embedding))
    if l2_norm <= 0:
        logger.error("Zero-norm embedding vector produced by recognition model.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Zero-norm embedding vector produced by model.",
        )

    normalized_vec = raw_embedding / l2_norm
    embedding_list = [round(float(v), 6) for v in normalized_vec]

    # 5. Quality evaluation & detection confidence
    quality_score = calculate_face_quality_score(img, face)
    detection_confidence = round(float(face.det_score), 4) if hasattr(face, "det_score") else 0.0

    return embedding_list, quality_score, detection_confidence


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
        embedding_vector, quality_score, confidence = await run_in_threadpool(_extract_512d_embedding, img, face_app)
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
        embedding_vector, quality_score, confidence = await run_in_threadpool(_extract_512d_embedding, img, face_app)
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
        execution_time_ms=execution_time_ms,
    )

