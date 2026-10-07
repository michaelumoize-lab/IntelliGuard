from typing import List, Optional
from pydantic import BaseModel, Field


class DetectedFace(BaseModel):
    """Schema representing a single detected face."""
    bbox: List[float] = Field(
        ...,
        description="Bounding box coordinates [x1, y1, x2, y2]",
        examples=[[245.4, 53.3, 365.3, 226.4]],
    )
    confidence: float = Field(
        ...,
        description="Detection confidence score between 0.0 and 1.0",
        examples=[0.98],
    )
    landmarks: Optional[List[List[float]]] = Field(
        default=None,
        description="5-point facial keypoints [[x1, y1], [x2, y2], ...]",
        examples=[[[260.1, 100.2], [320.5, 98.4], [290.0, 140.1], [270.2, 180.5], [315.6, 179.8]]],
    )


class Base64DetectRequest(BaseModel):
    """Schema for detecting faces from a base64 encoded image string."""
    image_base64: str = Field(
        ...,
        description="Base64-encoded image string (with or without data URI header)",
    )


class FaceDetectionResponse(BaseModel):
    """Schema representing the face detection response."""
    success: bool = Field(True, description="Whether face detection succeeded")
    face_count: int = Field(..., description="Number of faces detected in the image")
    faces: List[DetectedFace] = Field(..., description="List of detected face details")
    execution_time_ms: Optional[float] = Field(
        default=None,
        description="Inference execution time in milliseconds",
    )
