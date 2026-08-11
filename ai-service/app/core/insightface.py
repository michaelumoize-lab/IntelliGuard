import logging
from typing import Optional, List, Tuple
import onnxruntime as ort
from insightface.app import FaceAnalysis

from app.core.config import settings

logger = logging.getLogger("intelliguard.insightface")


class InsightFaceManager:
    """Singleton manager responsible for loading and holding the InsightFace model."""

    def __init__(self, model_name: str = "buffalo_s") -> None:
        self.model_name: str = model_name
        self.app: Optional[FaceAnalysis] = None
        self.is_loaded: bool = False
        self.active_provider: str = "Unavailable"
        self.error_message: Optional[str] = None

    def initialize(self, det_size: Tuple[int, int] = (320, 320)) -> bool:
        """Initialize the InsightFace FaceAnalysis model.
        
        This method is intended to be called once during FastAPI startup.
        """
        if self.is_loaded and self.app is not None:
            logger.info("InsightFace model is already loaded in memory.")
            return True

        try:
            available_providers = ort.get_available_providers()
            logger.info(f"Available ONNX Runtime execution providers: {available_providers}")

            # Prioritize CUDA if installed and available, fallback to CPU
            providers: List[str] = []
            if "CUDAExecutionProvider" in available_providers:
                providers.append("CUDAExecutionProvider")
            providers.append("CPUExecutionProvider")

            logger.info(f"Initializing InsightFace FaceAnalysis (model='{self.model_name}') with providers={providers}...")
            
            # Load only detection and recognition modules to save memory (avoids loading 3D landmarks & genderage models)
            face_app = FaceAnalysis(name=self.model_name, allowed_modules=['detection', 'recognition'], providers=providers)
            face_app.prepare(ctx_id=0, det_size=det_size)

            self.app = face_app
            self.is_loaded = True
            self.error_message = None

            # Dynamically determine the active execution provider from ONNX session
            if hasattr(face_app, "models") and face_app.models:
                first_model = next(iter(face_app.models.values()))
                if hasattr(first_model, "session") and first_model.session:
                    session_providers = first_model.session.get_providers()
                    if session_providers:
                        self.active_provider = session_providers[0]
                    else:
                        self.active_provider = providers[0]
                else:
                    self.active_provider = providers[0]
            else:
                self.active_provider = providers[0]

            logger.info(
                f"InsightFace model '{self.model_name}' successfully loaded into memory. Active provider: {self.active_provider}"
            )
            return True

        except Exception as err:
            self.is_loaded = False
            self.app = None
            self.active_provider = "Unavailable"
            self.error_message = str(err)
            logger.error(f"Failed to initialize InsightFace model '{self.model_name}': {err}", exc_info=True)
            return False


# Shared model manager instance initialized with model name from settings
insightface_manager = InsightFaceManager(model_name=settings.INSIGHTFACE_MODEL)
