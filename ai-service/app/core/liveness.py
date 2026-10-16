import os
import urllib.request
import hashlib
import logging
import time
from typing import Optional, List, Tuple, Dict, Any, NamedTuple
import numpy as np
import cv2
import onnxruntime as ort

from app.core.config import settings

logger = logging.getLogger("intelliguard.liveness")


class LivenessResult(NamedTuple):
    """Result data structure for facial anti-spoofing verification."""
    is_live: bool
    status: str  # "live", "spoof", "inconclusive", "error"
    score: float  # Real face confidence score between 0.0 and 1.0 (uncalibrated model metric)
    real_logit: float
    spoof_logit: float
    execution_time_ms: float
    error_message: Optional[str] = None


def ensure_liveness_model(
    model_name: str = settings.LIVENESS_MODEL_NAME,
    model_url: str = settings.LIVENESS_MODEL_URL,
    expected_checksum: Optional[str] = settings.LIVENESS_CHECKSUM,
) -> str:
    """Ensure MiniFASNet ONNX model weights exist locally with valid SHA256 checksum.
    
    Downloads to ~/.cache/intelliguard/models/{model_name}.onnx if missing.
    """
    cache_dir = os.path.expanduser("~/.cache/intelliguard/models")
    os.makedirs(cache_dir, exist_ok=True)
    model_path = os.path.join(cache_dir, f"{model_name}.onnx")

    def _verify_checksum(filepath: str) -> bool:
        if not expected_checksum:
            return True
        sha256 = hashlib.sha256()
        with open(filepath, "rb") as f:
            while chunk := f.read(65536):
                sha256.update(chunk)
        digest = sha256.hexdigest().lower()
        if digest != expected_checksum.lower():
            logger.warning(
                f"Checksum mismatch for {filepath}. Expected {expected_checksum}, got {digest}."
            )
            return False
        return True

    if os.path.exists(model_path) and _verify_checksum(model_path):
        logger.info(f"Liveness model '{model_name}.onnx' verified in local cache: {model_path}")
        return model_path

    logger.info(f"Downloading MiniFASNet liveness model '{model_name}.onnx' from {model_url}...")
    temp_path = f"{model_path}.tmp"
    req = urllib.request.Request(model_url, headers={"User-Agent": "IntelliGuard/1.0"})

    try:
        with urllib.request.urlopen(req, timeout=60) as response, open(temp_path, "wb") as out_file:
            while chunk := response.read(65536):
                out_file.write(chunk)

        if not _verify_checksum(temp_path):
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise ValueError(
                f"Downloaded liveness model failed checksum verification ({expected_checksum})."
            )

        if os.path.exists(model_path):
            os.remove(model_path)
        os.rename(temp_path, model_path)
        logger.info(f"Successfully downloaded and verified liveness model: {model_path}")
        return model_path
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        logger.error(f"Failed to download liveness model from {model_url}: {e}")
        raise


def preprocess_face_crop(
    img: np.ndarray,
    face_bbox: List[float],
    target_size: int = settings.LIVENESS_INPUT_SIZE,
    expansion_factor: float = 1.25,
) -> np.ndarray:
    """Preprocess detected face crop for MiniFASNetV2-SE inference.
    
    1. Expands face bounding box by expansion_factor to capture peripheral context
       (crucial for detecting paper edges, phone bezels, and specular reflections).
    2. Resizes with aspect ratio preservation and reflection padding (BORDER_REFLECT_101).
    3. Converts BGR to RGB.
    4. Normalizes pixel values to [0.0, 1.0] and transposes to CHW format: (1, 3, target_size, target_size).
    """
    img_h, img_w = img.shape[:2]
    x1, y1, x2, y2 = [float(c) for c in face_bbox]

    box_w = max(1.0, x2 - x1)
    box_h = max(1.0, y2 - y1)
    cx = x1 + box_w / 2.0
    cy = y1 + box_h / 2.0

    exp_w = box_w * expansion_factor
    exp_h = box_h * expansion_factor

    crop_x1 = max(0, int(cx - exp_w / 2.0))
    crop_y1 = max(0, int(cy - exp_h / 2.0))
    crop_x2 = min(img_w, int(cx + exp_w / 2.0))
    crop_y2 = min(img_h, int(cy + exp_h / 2.0))

    if crop_x2 <= crop_x1 or crop_y2 <= crop_y1:
        # Fallback to direct clamp
        crop_x1, crop_y1 = max(0, int(x1)), max(0, int(y1))
        crop_x2, crop_y2 = min(img_w, int(x2)), min(img_h, int(y2))

    face_crop = img[crop_y1:crop_y2, crop_x1:crop_x2]
    if face_crop.size == 0:
        face_crop = img

    old_h, old_w = face_crop.shape[:2]
    ratio = float(target_size) / max(old_h, old_w)
    scaled_w = max(1, int(old_w * ratio))
    scaled_h = max(1, int(old_h * ratio))

    interp = cv2.INTER_LANCZOS4 if ratio > 1.0 else cv2.INTER_AREA
    resized = cv2.resize(face_crop, (scaled_w, scaled_h), interpolation=interp)

    delta_w = target_size - scaled_w
    delta_h = target_size - scaled_h
    top = delta_h // 2
    bottom = delta_h - top
    left = delta_w // 2
    right = delta_w - left

    padded = cv2.copyMakeBorder(
        resized, top, bottom, left, right, cv2.BORDER_REFLECT_101
    )

    # Convert BGR to RGB, scale to [0, 1], transpose to CHW
    rgb = cv2.cvtColor(padded, cv2.COLOR_BGR2RGB)
    chw = rgb.transpose(2, 0, 1).astype(np.float32) / 255.0
    return np.expand_dims(chw, axis=0)


class LivenessDetector:
    """Manages ONNX runtime session for passive facial anti-spoofing."""

    def __init__(self) -> None:
        self.session: Optional[ort.InferenceSession] = None
        self.input_name: Optional[str] = None
        self.is_initialized: bool = False
        self.error_message: Optional[str] = None

    def initialize(self) -> bool:
        """Initialize the ONNX runtime session. Returns True if successful."""
        try:
            model_path = ensure_liveness_model()
            sess_options = ort.SessionOptions()
            sess_options.intra_op_num_threads = 2
            sess_options.inter_op_num_threads = 1
            sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

            self.session = ort.InferenceSession(
                model_path,
                sess_options=sess_options,
                providers=["CPUExecutionProvider"],
            )
            self.input_name = self.session.get_inputs()[0].name
            self.is_initialized = True
            self.error_message = None
            logger.info("MiniFASNet Liveness Detector initialized successfully.")
            return True
        except Exception as e:
            self.session = None
            self.input_name = None
            self.is_initialized = False
            self.error_message = str(e)
            logger.error(f"Failed to initialize MiniFASNet Liveness Detector: {e}")
            return False

    def predict(
        self,
        img: np.ndarray,
        face_bbox: List[float],
        threshold: float = settings.LIVENESS_THRESHOLD,
    ) -> LivenessResult:
        """Evaluate facial liveness from an image frame and face bounding box.
        
        Fail-Safe Principle:
        - Returns status='inconclusive' or 'error' if model is uninitialized or inference fails.
        - NEVER reports an internal exception as a confirmed spoof attack.
        - Returns status='spoof' only when the model successfully outputs a spoof classification.
        """
        start_t = time.perf_counter()

        if not self.is_initialized or self.session is None:
            elapsed_ms = round((time.perf_counter() - start_t) * 1000, 2)
            logger.warning("Liveness verification requested but detector is not initialized.")
            return LivenessResult(
                is_live=False,
                status="inconclusive",
                score=0.0,
                real_logit=0.0,
                spoof_logit=0.0,
                execution_time_ms=elapsed_ms,
                error_message=self.error_message or "Liveness detector is uninitialized.",
            )

        try:
            tensor = preprocess_face_crop(
                img,
                face_bbox,
                target_size=settings.LIVENESS_INPUT_SIZE,
            )

            outputs = self.session.run(None, {self.input_name: tensor})
            logits = outputs[0][0]  # shape: [2] -> [real_logit, spoof_logit]
            real_logit = float(logits[0])
            spoof_logit = float(logits[1])

            # Numerically stable softmax
            exp_logits = np.exp(logits - np.max(logits))
            probs = exp_logits / np.sum(exp_logits)
            p_real = float(probs[0])

            elapsed_ms = round((time.perf_counter() - start_t) * 1000, 2)
            is_live = bool(p_real >= threshold)
            status = "live" if is_live else "spoof"

            logger.info(
                f"Liveness evaluation: status={status}, confidence={p_real:.4f} "
                f"(threshold={threshold}), latency={elapsed_ms}ms"
            )

            return LivenessResult(
                is_live=is_live,
                status=status,
                score=round(p_real, 4),
                real_logit=round(real_logit, 4),
                spoof_logit=round(spoof_logit, 4),
                execution_time_ms=elapsed_ms,
                error_message=None,
            )
        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start_t) * 1000, 2)
            logger.error(f"Error during liveness inference: {e}", exc_info=True)
            return LivenessResult(
                is_live=False,
                status="inconclusive",
                score=0.0,
                real_logit=0.0,
                spoof_logit=0.0,
                execution_time_ms=elapsed_ms,
                error_message=f"Liveness inference failure: {str(e)}",
            )


liveness_detector = LivenessDetector()
