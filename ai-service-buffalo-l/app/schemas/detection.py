from typing import List, Optional, Dict
from pydantic import BaseModel, Field


class LivenessDetail(BaseModel):
    """Detailed anti-spoofing diagnostics from MiniFASNet dual-model ensemble."""
    status: str = Field(..., description="'live', 'spoof_detected', 'inconclusive', or 'error'")
    model: str = Field(default="MiniFASNetV2+MiniFASNetV1SE", description="Anti-spoofing model descriptor")
    live_score: float = Field(..., description="Combined bona fide confidence score (0.0 to 1.0)")
    threshold: Optional[float] = Field(default=None, description="Configured operational threshold for bona fide acceptance")
    live_threshold: Optional[float] = Field(default=None, description="Configured threshold for bona fide acceptance")
    spoof_threshold: Optional[float] = Field(default=None, description="Configured threshold for presentation attack rejection")
    individual_scores: Dict[str, float] = Field(
        default_factory=dict,
        description="Individual model scores (e.g. {'MiniFASNetV2': 0.98, 'MiniFASNetV1SE': 0.99})",
    )
    processing_time_ms: float = Field(default=0.0, description="Anti-spoofing inference latency in milliseconds")
    ensemble_method: Optional[str] = Field(default="mean", description="Ensemble fusion strategy ('mean' or 'min')")
    error_message: Optional[str] = Field(default=None, description="Technical error message if status is 'error'")


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


class DetectedPerson(BaseModel):
    """Schema representing a single detected person."""
    bbox: List[float] = Field(
        ...,
        description="Bounding box coordinates [x1, y1, x2, y2] in original image pixels",
        examples=[[100.0, 50.0, 450.0, 720.0]],
    )
    confidence: float = Field(
        ...,
        description="Detection confidence score between 0.0 and 1.0",
        examples=[0.94],
    )
    is_primary: bool = Field(
        default=False,
        description="Indicates whether this person is the primary (largest) subject in frame",
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


class UnifiedAnalysisResponse(BaseModel):
    """Schema representing the unified computer vision analysis response."""
    success: bool = Field(True, description="Whether the pipeline executed successfully")
    status: str = Field(
        ...,
        description="Pipeline status: 'no_person', 'person_no_face', 'face_low_quality', 'spoof_detected', 'liveness_inconclusive', 'face_detected_processing', 'known_individual', 'unknown_individual', or 'recognition_error'",
        examples=["person_no_face"],
    )
    person_detected: bool = Field(..., description="Whether at least one person was detected by YOLO")
    face_detected: bool = Field(..., description="Whether a face was detected by InsightFace")
    person_count: int = Field(..., description="Total count of detected persons")
    face_count: int = Field(..., description="Total count of detected faces")
    persons: List[DetectedPerson] = Field(default_factory=list, description="All detected person bounding boxes")
    faces: List[DetectedFace] = Field(default_factory=list, description="All detected face bounding boxes")
    primary_person_bbox: Optional[List[float]] = Field(
        default=None,
        description="Bounding box [x1, y1, x2, y2] of the primary person subject",
    )
    primary_face_bbox: Optional[List[float]] = Field(
        default=None,
        description="Bounding box [x1, y1, x2, y2] of the primary face",
    )
    embedding: Optional[List[float]] = Field(
        default=None,
        description="512-dimensional L2-normalized ArcFace embedding vector (if usable face detected)",
    )
    embedding_size: Optional[int] = Field(default=None, description="Embedding vector dimension (512)")
    quality_score: Optional[float] = Field(
        default=None,
        description="Composite biometric face quality score (0.0 to 1.0)",
    )
    detection_confidence: Optional[float] = Field(
        default=None,
        description="InsightFace face detection confidence (0.0 to 1.0)",
    )
    liveness: Optional[LivenessDetail] = Field(
        default=None,
        description="Anti-spoofing presentation attack detection evaluation details",
    )
    model: Optional[str] = Field(default=None, description="Active InsightFace recognition model name")
    image_width: int = Field(..., description="Source image width in pixels")
    image_height: int = Field(..., description="Source image height in pixels")
    message: Optional[str] = Field(default=None, description="Human-readable contextual message")
    execution_time_ms: float = Field(..., description="Total pipeline execution time in milliseconds")
    yolo_time_ms: Optional[float] = Field(default=None, description="YOLO person inference time in milliseconds")
    insightface_time_ms: Optional[float] = Field(default=None, description="InsightFace inference time in milliseconds")
    antispoof_time_ms: Optional[float] = Field(default=None, description="Anti-spoofing inference time in milliseconds")


class LivenessInspectionResponse(BaseModel):
    """Schema for dedicated anti-spoofing testing lab endpoint."""
    success: bool = Field(True, description="Whether liveness inspection succeeded")
    face_detected: bool = Field(..., description="Whether a face was detected in image")
    bbox: Optional[List[float]] = Field(default=None, description="Face bounding box [x1, y1, x2, y2]")
    detection_confidence: Optional[float] = Field(default=None, description="Detection confidence score")
    liveness: Optional[LivenessDetail] = Field(default=None, description="Anti-spoofing evaluation details")
    active_recognition_model: str = Field(..., description="Configured InsightFace model name (buffalo_s/buffalo_l)")
    guidance: Optional[str] = Field(default=None, description="Actionable human guidance")
    execution_time_ms: float = Field(..., description="Total inspection latency in milliseconds")
