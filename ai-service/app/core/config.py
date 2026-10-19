import os
from typing import List, Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Settings:
    """Application configuration settings."""

    APP_NAME: str = os.getenv("APP_NAME", "IntelliGuard AI")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    INSIGHTFACE_MODEL: str = os.getenv("INSIGHTFACE_MODEL", "buffalo_s")
    INSIGHTFACE_CHECKSUM: Optional[str] = os.getenv(
        "INSIGHTFACE_CHECKSUM", os.getenv("INSIGHTFACE_ZIP_CHECKSUM", None)
    )
    INSIGHTFACE_ZIP_CHECKSUM: Optional[str] = os.getenv(
        "INSIGHTFACE_ZIP_CHECKSUM", os.getenv("INSIGHTFACE_CHECKSUM", None)
    )
    MAX_CONCURRENT_INFERENCE: int = int(os.getenv("MAX_CONCURRENT_INFERENCE", "2"))
    YOLO_MODEL_NAME: str = os.getenv("YOLO_MODEL_NAME", "yolov8n")
    YOLO_MODEL_URL: str = os.getenv(
        "YOLO_MODEL_URL",
        "https://huggingface.co/Xuban/yolo_weights_database/resolve/main/yolov8n.onnx",
    )
    YOLO_CHECKSUM: str = os.getenv(
        "YOLO_CHECKSUM",
        "a7e5de35f0e094653cabcd67b4fa850a42693b2e9f251edc2a0931b937e7810e",
    )
    YOLO_CONFIDENCE_THRESHOLD: float = float(os.getenv("YOLO_CONFIDENCE_THRESHOLD", "0.40"))
    YOLO_IOU_THRESHOLD: float = float(os.getenv("YOLO_IOU_THRESHOLD", "0.45"))
    LIVENESS_MODEL_NAME: str = os.getenv("LIVENESS_MODEL_NAME", "minifasnet_quantized")
    LIVENESS_MODEL_URL: str = os.getenv(
        "LIVENESS_MODEL_URL",
        "https://raw.githubusercontent.com/facenox/face-antispoof-onnx/main/models/best_model_quantized.onnx",
    )
    LIVENESS_CHECKSUM: str = os.getenv(
        "LIVENESS_CHECKSUM",
        "fde20585635cae62ed1d41796f76b6f8bc4b92cd91ec1cf0f1bc6485d2d587a9",
    )
    LIVENESS_THRESHOLD: float = float(os.getenv("LIVENESS_THRESHOLD", "0.60"))
    LIVENESS_INPUT_SIZE: int = int(os.getenv("LIVENESS_INPUT_SIZE", "128"))
    AI_SERVICE_API_KEY: str = os.getenv("AI_SERVICE_API_KEY", "").strip()

    def __init__(self) -> None:
        if self.MAX_CONCURRENT_INFERENCE < 1:
            raise ValueError(
                f"MAX_CONCURRENT_INFERENCE must be at least 1, got {self.MAX_CONCURRENT_INFERENCE}"
            )
    
    # Raw CORS string
    _allowed_origins_raw: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
    
    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        if not self._allowed_origins_raw:
            return ["http://localhost:3000"]
        return [origin.strip() for origin in self._allowed_origins_raw.split(",") if origin.strip()]


settings = Settings()
