import time
import logging
from typing import List, Optional
from fastapi import APIRouter, File, UploadFile, Request, Response, HTTPException, status

from app.schemas.detection import FaceDetectionResponse, DetectedFace, Base64DetectRequest
from app.core.image import read_image_bytes_to_cv2, decode_base64_to_cv2

router = APIRouter()
logger = logging.getLogger("intelliguard.detect")


def _run_detection(img, face_app) -> List[DetectedFace]:
    """Execute InsightFace detection on OpenCV image array and return formatted DetectedFace list."""
    faces = face_app.get(img)
    detected_faces: List[DetectedFace] = []

    for face in faces:
        # Extract bounding box [x1, y1, x2, y2]
        bbox_coords = [round(float(coord), 2) for coord in face.bbox] if hasattr(face, "bbox") else []
        
        # Extract detection confidence score
        confidence = round(float(face.det_score), 4) if hasattr(face, "det_score") else 0.0

        # Extract 5-point facial keypoints
        landmarks: Optional[List[List[float]]] = None
        if hasattr(face, "kps") and face.kps is not None:
            landmarks = [[round(float(point[0]), 2), round(float(point[1]), 2)] for point in face.kps]

        detected_faces.append(
            DetectedFace(
                bbox=bbox_coords,
                confidence=confidence,
                landmarks=landmarks,
            )
        )

    return detected_faces


@router.post(
    "/detect",
    response_model=FaceDetectionResponse,
    status_code=status.HTTP_200_OK,
    summary="Detect faces in an uploaded image file",
    description="Accepts a multipart image upload (JPG, PNG, WebP) and returns bounding boxes, confidence scores, and landmark points for detected faces.",
)
async def detect_faces(
    request: Request,
    response: Response,
    file: UploadFile = File(..., description="Image file to analyze"),
) -> FaceDetectionResponse:
    manager = getattr(request.app.state, "insightface_manager", None)
    face_app = getattr(request.app.state, "insightface_app", None)

    if manager is None or not manager.is_loaded or face_app is None:
        logger.error("Detection requested but InsightFace model is not loaded.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Face detection service is unavailable. Model is not loaded.",
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

    # Perform inference
    faces = _run_detection(img, face_app)
    execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

    logger.info(f"Detection complete: {len(faces)} face(s) found in {execution_time_ms} ms.")

    return FaceDetectionResponse(
        success=True,
        face_count=len(faces),
        faces=faces,
        execution_time_ms=execution_time_ms,
    )


@router.post(
    "/detect/base64",
    response_model=FaceDetectionResponse,
    status_code=status.HTTP_200_OK,
    summary="Detect faces from a base64-encoded image",
    description="Accepts a base64 encoded image string and returns face detection details.",
)
async def detect_faces_base64(
    request: Request,
    payload: Base64DetectRequest,
) -> FaceDetectionResponse:
    manager = getattr(request.app.state, "insightface_manager", None)
    face_app = getattr(request.app.state, "insightface_app", None)

    if manager is None or not manager.is_loaded or face_app is None:
        logger.error("Detection requested but InsightFace model is not loaded.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Face detection service is unavailable. Model is not loaded.",
        )

    start_time = time.perf_counter()

    # Decode base64 to OpenCV array
    img = decode_base64_to_cv2(payload.image_base64)

    # Perform inference
    faces = _run_detection(img, face_app)
    execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

    logger.info(f"Base64 detection complete: {len(faces)} face(s) found in {execution_time_ms} ms.")

    return FaceDetectionResponse(
        success=True,
        face_count=len(faces),
        faces=faces,
        execution_time_ms=execution_time_ms,
    )
