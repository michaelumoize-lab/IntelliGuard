import os
import urllib.request
import zipfile
import logging
import asyncio
from typing import Optional, List, Tuple
import onnxruntime as ort
from insightface.app import FaceAnalysis

from app.core.config import settings

logger = logging.getLogger("intelliguard.insightface")


def ensure_minimal_models(model_name: str = "buffalo_s") -> str:
    """Ensure only required ONNX models (detection and recognition) exist in the model directory.

    Downloads the model archive if not present, extracts ONLY detection (det_*.onnx) and recognition
    (w600k_*.onnx) models, and discards heavy unused models (such as the 143MB 3D landmark model)
    to keep RAM footprint below 120MB on constrained cloud instances (e.g. Render 512MB tier).
    """
    models_dir = os.path.expanduser(f"~/.insightface/models/{model_name}")
    os.makedirs(models_dir, exist_ok=True)

    existing_files = os.listdir(models_dir) if os.path.exists(models_dir) else []
    has_det = any(f.startswith("det_") and f.endswith(".onnx") for f in existing_files)
    has_rec = any((f.startswith("w600k_") or "arcface" in f) and f.endswith(".onnx") for f in existing_files)

    if not (has_det and has_rec):
        logger.info(f"Downloading model archive for '{model_name}'...")
        zip_path = os.path.join(models_dir, f"{model_name}.zip")
        url = f"https://github.com/deepinsight/insightface/releases/download/model-zoo/{model_name}.zip"

        urllib.request.urlretrieve(url, zip_path)

        logger.info(f"Extracting minimal models (detection and recognition) for '{model_name}'...")
        with zipfile.ZipFile(zip_path, "r") as zf:
            for member in zf.namelist():
                filename = os.path.basename(member)
                if (filename.startswith("det_") or filename.startswith("w600k_")) and filename.endswith(".onnx"):
                    zf.extract(member, models_dir)

        if os.path.exists(zip_path):
            try:
                os.remove(zip_path)
            except OSError:
                pass

    # Prune any unused models that might exist from previous downloads to prevent FaceAnalysis from loading them
    for unused in ["1k3d68.onnx", "2d106det.onnx", "genderage.onnx"]:
        unused_path = os.path.join(models_dir, unused)
        if os.path.exists(unused_path):
            try:
                os.remove(unused_path)
                logger.info(f"Pruned unused model weight '{unused}' to save memory.")
            except OSError:
                pass

    return models_dir


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
            # 1. Ensure only required models exist to avoid loading unused 143MB landmark weights
            ensure_minimal_models(self.model_name)

            available_providers = ort.get_available_providers()
            logger.info(f"Available ONNX Runtime execution providers: {available_providers}")

            # Prioritize CUDA if installed and available, fallback to CPU
            providers: List[str] = []
            if "CUDAExecutionProvider" in available_providers:
                providers.append("CUDAExecutionProvider")
                ctx_id = 0
            else:
                ctx_id = -1
            providers.append("CPUExecutionProvider")

            logger.info(
                f"Initializing InsightFace FaceAnalysis (model='{self.model_name}') with providers={providers}, ctx_id={ctx_id}..."
            )

            # Restrict ONNX Runtime threads and disable memory arena hoarding for low-memory container environments
            sess_options = ort.SessionOptions()
            sess_options.intra_op_num_threads = 1
            sess_options.inter_op_num_threads = 1
            sess_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
            sess_options.enable_cpu_mem_arena = False

            # Load only detection and recognition modules with optimized session options
            face_app = FaceAnalysis(
                name=self.model_name,
                allowed_modules=["detection", "recognition"],
                providers=providers,
                sess_options=sess_options,
            )
            face_app.prepare(ctx_id=ctx_id, det_size=det_size)

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

# Model-safe concurrency limiter to serialize InsightFace inference across endpoints
inference_semaphore = asyncio.Semaphore(1)
