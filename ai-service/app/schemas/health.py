from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class HealthResponse(BaseModel):
    """Pydantic response model for the health check endpoint."""

    status: str = Field(..., description="Overall health status: 'healthy' or 'degraded'")
    service: str = Field(..., description="Name of the service")
    model: str = Field(..., description="Configured InsightFace model name")
    model_loaded: bool = Field(..., description="Indicates whether the AI model is loaded in memory")
    execution_provider: str = Field(..., description="Active ONNX Runtime execution provider")
    error: Optional[str] = Field(None, description="Initialization error details if status is degraded")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "healthy",
                "service": "intelliguard-ai",
                "model": "buffalo_s",
                "model_loaded": True,
                "execution_provider": "CPUExecutionProvider",
                "error": None,
            }
        }
    )
