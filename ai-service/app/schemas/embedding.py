from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class Base64EmbeddingRequest(BaseModel):
    """Schema for requesting a face embedding from a base64 encoded image string."""
    image_base64: str = Field(
        ...,
        description="Base64-encoded image string (with or without data URI header)",
    )


class FaceEmbeddingResponse(BaseModel):
    """Pydantic response schema for 512-dimensional facial embedding generation."""
    success: bool = Field(True, description="Whether face embedding generation succeeded")
    face_detected: bool = Field(True, description="Whether a valid face was detected")
    embedding: List[float] = Field(
        ...,
        description="512-dimensional L2-normalized facial embedding vector",
    )
    embedding_size: int = Field(512, description="Dimensions of the facial embedding vector (512)")
    normalized: bool = Field(True, description="Indicates whether the vector is L2 normalized (||v|| = 1.0)")
    quality_score: float = Field(
        ...,
        description="Composite face quality score between 0.0 and 1.0",
        examples=[0.94],
    )
    detection_confidence: float = Field(
        ...,
        description="Face detection confidence score between 0.0 and 1.0",
        examples=[0.98],
    )
    model: str = Field("buffalo_s", description="Name of the InsightFace model pack used")
    model_version: Optional[str] = Field(None, description="Model version if available")
    execution_time_ms: float = Field(..., description="Inference execution time in milliseconds")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "face_detected": True,
                "embedding": [0.0245, -0.0112, 0.0891],  # Truncated representation for schema docs
                "embedding_size": 512,
                "normalized": True,
                "quality_score": 0.94,
                "detection_confidence": 0.98,
                "model": "buffalo_s",
                "model_version": None,
                "execution_time_ms": 142.37,
            }
        }
    )
