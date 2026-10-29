import os
from typing import List, Optional, Tuple
from dotenv import load_dotenv

# Preserve existing runtime environment variables by default; enable override only in development
_env_mode = os.getenv("ENVIRONMENT", "development").strip().lower()
load_dotenv(override=(_env_mode == "development"))


class Settings:
    """Application configuration settings."""

    APP_NAME: str = os.getenv("APP_NAME", "IntelliGuard AI")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    INSIGHTFACE_MODEL: str = os.getenv("INSIGHTFACE_MODEL", "buffalo_s").strip().lower()
    INSIGHTFACE_DET_SIZE_W: int = int(os.getenv("INSIGHTFACE_DET_SIZE_W", "640" if os.getenv("INSIGHTFACE_MODEL", "buffalo_s").strip().lower() == "buffalo_l" else "320"))
    INSIGHTFACE_DET_SIZE_H: int = int(os.getenv("INSIGHTFACE_DET_SIZE_H", "640" if os.getenv("INSIGHTFACE_MODEL", "buffalo_s").strip().lower() == "buffalo_l" else "320"))
    INSIGHTFACE_DET_SIZE: Tuple[int, int] = (INSIGHTFACE_DET_SIZE_W, INSIGHTFACE_DET_SIZE_H)
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
    AI_SERVICE_API_KEY: str = os.getenv("AI_SERVICE_API_KEY", "").strip()

    # Tailgating & Multi-Person Physical Access Configuration
    TAILGATING_DETECTION_ENABLED: bool = os.getenv("TAILGATING_DETECTION_ENABLED", "true").lower() in ("true", "1", "yes")
    TAILGATING_CONFIDENCE_THRESHOLD: float = float(os.getenv("TAILGATING_CONFIDENCE_THRESHOLD", "0.35"))
    TAILGATING_CRITICAL_DISTANCE: float = float(os.getenv("TAILGATING_CRITICAL_DISTANCE", "0.45"))

    # Anti-Spoofing Configuration (MiniFASNet Dual-Model Ensemble)
    ANTISPOOF_ENABLED: bool = os.getenv("ANTISPOOF_ENABLED", "true").lower() in ("true", "1", "yes")
    ANTISPOOF_MODEL_V2_URL: str = os.getenv(
        "ANTISPOOF_MODEL_V2_URL",
        "https://github.com/yakhyo/face-anti-spoofing/releases/download/weights/MiniFASNetV2.onnx",
    )
    ANTISPOOF_MODEL_V1SE_URL: str = os.getenv(
        "ANTISPOOF_MODEL_V1SE_URL",
        "https://github.com/yakhyo/face-anti-spoofing/releases/download/weights/MiniFASNetV1SE.onnx",
    )
    ANTISPOOF_MODEL_V2_PATH: Optional[str] = os.getenv("ANTISPOOF_MODEL_V2_PATH", None)
    ANTISPOOF_MODEL_V1SE_PATH: Optional[str] = os.getenv("ANTISPOOF_MODEL_V1SE_PATH", None)
    ANTISPOOF_V2_CHECKSUM: str = os.getenv(
        "ANTISPOOF_V2_CHECKSUM",
        "b32929adc2d9c34b9486f8c4c7bc97c1b69bc0ea9befefc380e4faae4e463907",
    )
    ANTISPOOF_V1SE_CHECKSUM: str = os.getenv(
        "ANTISPOOF_V1SE_CHECKSUM",
        "ebab7f90c7833fbccd46d3a555410e78d969db5438e169b6524be444862b3676",
    )
    ANTISPOOF_LIVE_THRESHOLD: float = float(os.getenv("ANTISPOOF_LIVE_THRESHOLD", "0.80"))
    ANTISPOOF_SPOOF_THRESHOLD: float = float(os.getenv("ANTISPOOF_SPOOF_THRESHOLD", "0.45"))
    ANTISPOOF_ENSEMBLE_METHOD: str = os.getenv("ANTISPOOF_ENSEMBLE_METHOD", "mean")

    # Local & Container Threading Tuning
    ORT_NUM_THREADS: int = int(os.getenv("ORT_NUM_THREADS", "0"))
    ORT_ENABLE_MEM_ARENA: bool = os.getenv("ORT_ENABLE_MEM_ARENA", "true").lower() in ("true", "1", "yes")

    def __init__(self) -> None:
        if self.MAX_CONCURRENT_INFERENCE < 1:
            raise ValueError(
                f"MAX_CONCURRENT_INFERENCE must be at least 1, got {self.MAX_CONCURRENT_INFERENCE}"
            )
        if not (0.0 < self.ANTISPOOF_LIVE_THRESHOLD <= 1.0):
            raise ValueError(
                f"ANTISPOOF_LIVE_THRESHOLD must be in (0.0, 1.0], got {self.ANTISPOOF_LIVE_THRESHOLD}"
            )
        if not (0.0 <= self.ANTISPOOF_SPOOF_THRESHOLD < 1.0):
            raise ValueError(
                f"ANTISPOOF_SPOOF_THRESHOLD must be in [0.0, 1.0), got {self.ANTISPOOF_SPOOF_THRESHOLD}"
            )
        if self.ANTISPOOF_LIVE_THRESHOLD <= self.ANTISPOOF_SPOOF_THRESHOLD:
            raise ValueError(
                f"ANTISPOOF_LIVE_THRESHOLD ({self.ANTISPOOF_LIVE_THRESHOLD}) must be strictly greater than "
                f"ANTISPOOF_SPOOF_THRESHOLD ({self.ANTISPOOF_SPOOF_THRESHOLD})"
            )
    
    def reload(self) -> None:
        """Reload environment variables from .env and recompute configuration values."""
        env_mode = os.getenv("ENVIRONMENT", self.ENVIRONMENT).strip().lower()
        load_dotenv(override=(env_mode == "development"))
        self.INSIGHTFACE_MODEL = os.getenv("INSIGHTFACE_MODEL", "buffalo_s").strip().lower()
        is_buffalo_l = self.INSIGHTFACE_MODEL == "buffalo_l"
        default_det_size = "640" if is_buffalo_l else "320"
        self.INSIGHTFACE_DET_SIZE_W = int(os.getenv("INSIGHTFACE_DET_SIZE_W", default_det_size))
        self.INSIGHTFACE_DET_SIZE_H = int(os.getenv("INSIGHTFACE_DET_SIZE_H", default_det_size))
        self.INSIGHTFACE_DET_SIZE = (self.INSIGHTFACE_DET_SIZE_W, self.INSIGHTFACE_DET_SIZE_H)
        self.INSIGHTFACE_CHECKSUM = os.getenv(
            "INSIGHTFACE_CHECKSUM", os.getenv("INSIGHTFACE_ZIP_CHECKSUM", None)
        )
        self.INSIGHTFACE_ZIP_CHECKSUM = os.getenv(
            "INSIGHTFACE_ZIP_CHECKSUM", os.getenv("INSIGHTFACE_CHECKSUM", None)
        )

    # Raw CORS string
    _allowed_origins_raw: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
    
    @property
    def INSIGHTFACE_DET_SIZE(self) -> tuple[int, int]:
        return (self.INSIGHTFACE_DET_SIZE_W, self.INSIGHTFACE_DET_SIZE_H)

    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        if not self._allowed_origins_raw:
            return ["http://localhost:3000"]
        return [origin.strip() for origin in self._allowed_origins_raw.split(",") if origin.strip()]


settings = Settings()
