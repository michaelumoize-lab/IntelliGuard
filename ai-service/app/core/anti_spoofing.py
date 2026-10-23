import os
import time
import hashlib
import urllib.request
import logging
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass, asdict
import numpy as np
import cv2
import onnxruntime as ort

from app.core.config import settings

logger = logging.getLogger("intelliguard.anti_spoofing")

# Trusted SHA256 checksums from the official yakhyo/face-anti-spoofing release assets
TRUSTED_CHECKSUMS: Dict[str, str] = {
    "MiniFASNetV2": "b32929adc2d9c34b9486f8c4c7bc97c1b69bc0ea9befefc380e4faae4e463907",
    "MiniFASNetV1SE": "ebab7f90c7833fbccd46d3a555410e78d969db5438e169b6524be444862b3676",
}

DEFAULT_MODEL_URLS: Dict[str, str] = {
    "MiniFASNetV2": "https://github.com/yakhyo/face-anti-spoofing/releases/download/weights/MiniFASNetV2.onnx",
    "MiniFASNetV1SE": "https://github.com/yakhyo/face-anti-spoofing/releases/download/weights/MiniFASNetV1SE.onnx",
}

# Empirical crop scales from yakhyo/face-anti-spoofing and Silent-Face-Anti-Spoofing
MODEL_SCALES: Dict[str, float] = {
    "MiniFASNetV2": 2.7,
    "MiniFASNetV1SE": 4.0,
}


@dataclass
class AntiSpoofResult:
    """Structured presentation attack detection evaluation result."""
    status: str                       # 'live', 'spoof_detected', 'inconclusive', 'error'
    is_live: bool                     # True if status == 'live'
    live_score: float                 # 0.0 to 1.0 ensemble real confidence
    live_threshold: float             # Configured threshold for bona fide acceptance
    spoof_threshold: float            # Configured threshold for presentation attack rejection
    individual_scores: Dict[str, float] # Model-specific scores (e.g. {'MiniFASNetV2': 0.98, ...})
    processing_time_ms: float         # Inference execution time in milliseconds
    model: str                        # Active anti-spoofing model descriptor
    ensemble_method: str = "mean"
    error_message: Optional[str] = None # Details if an error occurred

    @property
    def threshold(self) -> float:
        return self.live_threshold

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["threshold"] = self.live_threshold
        return d


def ensure_anti_spoof_weights(
    model_name: str,
    custom_path: Optional[str] = None,
    model_url: Optional[str] = None,
    expected_checksum: Optional[str] = None,
) -> str:
    """Ensure ONNX weights exist locally with valid SHA256 integrity check.
    
    Downloads from the official yakhyo/face-anti-spoofing release if missing.
    """
    expected_sha = (expected_checksum or TRUSTED_CHECKSUMS.get(model_name, "")).lower()

    def _verify_file(path: str) -> bool:
        if not expected_sha:
            return True
        sha = hashlib.sha256()
        with open(path, "rb") as f:
            while chunk := f.read(65536):
                sha.update(chunk)
        digest = sha.hexdigest().lower()
        if digest != expected_sha:
            logger.warning(
                f"Checksum mismatch for {model_name} at {path}. Expected {expected_sha}, got {digest}."
            )
            return False
        return True

    if custom_path and os.path.exists(custom_path):
        if expected_sha and not _verify_file(custom_path):
            raise ValueError(f"Checksum mismatch for anti-spoofing model '{model_name}' at {custom_path}.")
        return custom_path

    cache_dir = os.path.expanduser("~/.cache/intelliguard/models")
    os.makedirs(cache_dir, exist_ok=True)
    target_path = custom_path or os.path.join(cache_dir, f"{model_name}.onnx")

    if os.path.exists(target_path) and _verify_file(target_path):
        logger.info(f"Verified anti-spoofing model '{model_name}' in local cache: {target_path}")
        return target_path

    url = model_url or DEFAULT_MODEL_URLS.get(model_name)
    if not url:
        raise ValueError(f"No download URL configured for anti-spoofing model '{model_name}'.")

    logger.info(f"Downloading anti-spoofing model '{model_name}' from {url}...")
    temp_path = f"{target_path}.tmp"
    req = urllib.request.Request(url, headers={"User-Agent": "IntelliGuard/1.0"})

    try:
        with urllib.request.urlopen(req, timeout=120) as resp, open(temp_path, "wb") as out_f:
            while chunk := resp.read(65536):
                out_f.write(chunk)

        if not _verify_file(temp_path):
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise ValueError(f"Downloaded model '{model_name}' failed checksum verification.")

        if os.path.exists(target_path):
            os.remove(target_path)
        os.rename(temp_path, target_path)
        logger.info(f"Saved verified anti-spoofing model '{model_name}' to {target_path}")
        return target_path

    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


def crop_face_for_model(
    image: np.ndarray,
    bbox_xyxy: List[float],
    scale: float,
    target_size: Tuple[int, int] = (80, 80),
) -> np.ndarray:
    """Crop and scale face region from original BGR image using yakhyo/face-anti-spoofing geometry.
    
    Applies boundary-aware dynamic scaling to capture contextual edges (bezel, screen reflection,
    ears, and neck) essential for presentation attack detection.
    """
    if image is None or image.size == 0:
        raise ValueError("Cannot crop face from empty or None image array.")

    src_h, src_w = image.shape[:2]
    if len(bbox_xyxy) != 4:
        raise ValueError(f"Expected 4 bounding box coordinates [x1, y1, x2, y2], got {bbox_xyxy}")

    x1, y1, x2, y2 = [float(c) for c in bbox_xyxy]
    if x2 <= x1 or y2 <= y1:
        raise ValueError(f"Invalid bounding box coordinates: [{x1}, {y1}, {x2}, {y2}] (x2 <= x1 or y2 <= y1)")
    box_w = max(1.0, x2 - x1)
    box_h = max(1.0, y2 - y1)

    # Dynamic boundary scaling
    eff_scale = min((src_h - 1) / box_h, (src_w - 1) / box_w, scale)
    new_w = box_w * eff_scale
    new_h = box_h * eff_scale

    center_x = x1 + box_w / 2.0
    center_y = y1 + box_h / 2.0

    x1_c = max(0, int(round(center_x - new_w / 2.0)))
    y1_c = max(0, int(round(center_y - new_h / 2.0)))
    x2_c = min(src_w - 1, int(round(center_x + new_w / 2.0)))
    y2_c = min(src_h - 1, int(round(center_y + new_h / 2.0)))

    if x2_c <= x1_c or y2_c <= y1_c:
        raise ValueError(f"Invalid crop dimensions computed: [{x1_c}, {y1_c}, {x2_c}, {y2_c}]")

    crop = image[y1_c : y2_c + 1, x1_c : x2_c + 1]
    return cv2.resize(crop, target_size, interpolation=cv2.INTER_LINEAR)


def softmax(x: np.ndarray) -> np.ndarray:
    """Numerically stable softmax implementation."""
    e_x = np.exp(x - np.max(x, axis=1, keepdims=True))
    return e_x / np.sum(e_x, axis=1, keepdims=True)


class AntiSpoofingManager:
    """Manages the MiniFASNet dual-model ensemble for facial presentation attack detection."""

    def __init__(self) -> None:
        self.is_loaded: bool = False
        self.error_message: Optional[str] = None
        self.active_provider: str = "Unavailable"

        # Model sessions and metadata
        self.session_v2: Optional[ort.InferenceSession] = None
        self.input_name_v2: str = "input"
        self.input_size_v2: Tuple[int, int] = (80, 80)

        self.session_v1se: Optional[ort.InferenceSession] = None
        self.input_name_v1se: str = "input"
        self.input_size_v1se: Tuple[int, int] = (80, 80)

    def initialize(self) -> bool:
        """Initialize ONNX Runtime sessions for MiniFASNetV2 and MiniFASNetV1SE once during startup."""
        if self.is_loaded:
            logger.info("Anti-spoofing models are already loaded in memory.")
            return True

        try:
            v2_path = ensure_anti_spoof_weights(
                model_name="MiniFASNetV2",
                custom_path=settings.ANTISPOOF_MODEL_V2_PATH,
                model_url=settings.ANTISPOOF_MODEL_V2_URL,
                expected_checksum=settings.ANTISPOOF_V2_CHECKSUM,
            )
            v1se_path = ensure_anti_spoof_weights(
                model_name="MiniFASNetV1SE",
                custom_path=settings.ANTISPOOF_MODEL_V1SE_PATH,
                model_url=settings.ANTISPOOF_MODEL_V1SE_URL,
                expected_checksum=settings.ANTISPOOF_V1SE_CHECKSUM,
            )

            available_providers = ort.get_available_providers()
            providers: List[str] = []
            if "CUDAExecutionProvider" in available_providers:
                providers.append("CUDAExecutionProvider")
            providers.append("CPUExecutionProvider")

            sess_options = ort.SessionOptions()
            if settings.ORT_NUM_THREADS > 0:
                sess_options.intra_op_num_threads = settings.ORT_NUM_THREADS
                sess_options.inter_op_num_threads = settings.ORT_NUM_THREADS
            sess_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
            sess_options.enable_cpu_mem_arena = settings.ORT_ENABLE_MEM_ARENA

            logger.info(f"Loading MiniFASNetV2 from {v2_path} with providers={providers}...")
            self.session_v2 = ort.InferenceSession(v2_path, sess_options=sess_options, providers=providers)
            inp_v2 = self.session_v2.get_inputs()[0]
            self.input_name_v2 = inp_v2.name
            if len(inp_v2.shape) == 4 and isinstance(inp_v2.shape[2], int) and isinstance(inp_v2.shape[3], int):
                self.input_size_v2 = (inp_v2.shape[3], inp_v2.shape[2])

            logger.info(f"Loading MiniFASNetV1SE from {v1se_path} with providers={providers}...")
            self.session_v1se = ort.InferenceSession(v1se_path, sess_options=sess_options, providers=providers)
            inp_v1se = self.session_v1se.get_inputs()[0]
            self.input_name_v1se = inp_v1se.name
            if len(inp_v1se.shape) == 4 and isinstance(inp_v1se.shape[2], int) and isinstance(inp_v1se.shape[3], int):
                self.input_size_v1se = (inp_v1se.shape[3], inp_v1se.shape[2])

            active_providers = self.session_v2.get_providers()
            self.active_provider = active_providers[0] if active_providers else providers[0]

            self.is_loaded = True
            self.error_message = None
            logger.info(
                f"Dual-model anti-spoofing engine loaded successfully. Active provider: {self.active_provider}"
            )
            return True

        except Exception as err:
            self.is_loaded = False
            self.error_message = str(err)
            logger.error(f"Failed to initialize anti-spoofing dual-model engine: {err}", exc_info=True)
            return False

    load_models = initialize

    @property
    def live_threshold(self) -> float:
        return settings.ANTISPOOF_LIVE_THRESHOLD

    @property
    def spoof_threshold(self) -> float:
        return settings.ANTISPOOF_SPOOF_THRESHOLD

    def _infer_single_model(
        self,
        session: ort.InferenceSession,
        input_name: str,
        image_bgr: np.ndarray,
        bbox_xyxy: List[float],
        scale: float,
        target_size: Tuple[int, int],
    ) -> float:
        """Run single MiniFASNet forward pass and return real/live class probability."""
        crop = crop_face_for_model(image_bgr, bbox_xyxy, scale=scale, target_size=target_size)
        
        # Format BGR (H, W, C) float32 -> (1, C, H, W) in [0, 255] range as expected by MiniFASNet
        tensor = crop.astype(np.float32).transpose(2, 0, 1)
        tensor = np.expand_dims(tensor, axis=0)

        outputs = session.run(None, {input_name: tensor})
        logits = outputs[0]
        probs = softmax(logits)

        # Class index 1 corresponds to Bona Fide / Genuine / Live face
        # Class index 0 is 2D attack, Class index 2 is other presentation attack
        if probs.shape[1] > 1:
            return float(probs[0, 1])
        return float(probs[0, 0])

    def predict_liveness(
        self,
        image_bgr: np.ndarray,
        bbox_xyxy: List[float],
    ) -> AntiSpoofResult:
        """Run dual-model ensemble inference on a detected face bounding box.
        
        Args:
            image_bgr: Original uncropped BGR OpenCV image.
            bbox_xyxy: Face bounding box coordinates [x1, y1, x2, y2].
            
        Returns:
            AntiSpoofResult containing status ('live', 'spoof_detected', 'inconclusive'),
            individual model scores, ensemble live score, and processing latency.
        """
        start_time = time.perf_counter()

        if not self.is_loaded or self.session_v2 is None or self.session_v1se is None:
            return AntiSpoofResult(
                status="error",
                is_live=False,
                live_score=0.0,
                live_threshold=settings.ANTISPOOF_LIVE_THRESHOLD,
                spoof_threshold=settings.ANTISPOOF_SPOOF_THRESHOLD,
                individual_scores={},
                processing_time_ms=0.0,
                model="MiniFASNetV2+MiniFASNetV1SE",
                error_message=self.error_message or "Anti-spoofing models are not loaded in memory.",
            )

        try:
            # 1. MiniFASNetV2 (scale = 2.7)
            score_v2 = self._infer_single_model(
                session=self.session_v2,
                input_name=self.input_name_v2,
                image_bgr=image_bgr,
                bbox_xyxy=bbox_xyxy,
                scale=MODEL_SCALES["MiniFASNetV2"],
                target_size=self.input_size_v2,
            )

            # 2. MiniFASNetV1SE (scale = 4.0)
            score_v1se = self._infer_single_model(
                session=self.session_v1se,
                input_name=self.input_name_v1se,
                image_bgr=image_bgr,
                bbox_xyxy=bbox_xyxy,
                scale=MODEL_SCALES["MiniFASNetV1SE"],
                target_size=self.input_size_v1se,
            )

            individual_scores = {
                "MiniFASNetV2": round(score_v2, 4),
                "MiniFASNetV1SE": round(score_v1se, 4),
            }

            # 3. Ensemble Fusion Strategy
            if settings.ANTISPOOF_ENSEMBLE_METHOD.lower() == "min":
                ensemble_score = min(score_v2, score_v1se)
            elif settings.ANTISPOOF_ENSEMBLE_METHOD.lower() == "v2_weighted":
                ensemble_score = 0.6 * score_v2 + 0.4 * score_v1se
            else:  # Default: mean class-score fusion matching reference implementation
                ensemble_score = (score_v2 + score_v1se) / 2.0

            ensemble_score = round(float(ensemble_score), 4)

            # 4. Tri-State Security Outcome Evaluation
            live_th = settings.ANTISPOOF_LIVE_THRESHOLD
            spoof_th = settings.ANTISPOOF_SPOOF_THRESHOLD

            if ensemble_score >= live_th:
                status = "live"
                is_live = True
            elif ensemble_score < spoof_th:
                status = "spoof_detected"
                is_live = False
            else:
                # Uncertainty / Inconclusive region between spoof_threshold and live_threshold
                status = "inconclusive"
                is_live = False

            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

            return AntiSpoofResult(
                status=status,
                is_live=is_live,
                live_score=ensemble_score,
                live_threshold=live_th,
                spoof_threshold=spoof_th,
                individual_scores=individual_scores,
                processing_time_ms=latency_ms,
                model="MiniFASNetV2+MiniFASNetV1SE",
                ensemble_method=settings.ANTISPOOF_ENSEMBLE_METHOD,
                error_message=None,
            )

        except Exception as err:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error(f"Anti-spoofing inference exception: {err}", exc_info=True)
            return AntiSpoofResult(
                status="error",
                is_live=False,
                live_score=0.0,
                live_threshold=settings.ANTISPOOF_LIVE_THRESHOLD,
                spoof_threshold=settings.ANTISPOOF_SPOOF_THRESHOLD,
                individual_scores={},
                processing_time_ms=latency_ms,
                model="MiniFASNetV2+MiniFASNetV1SE",
                ensemble_method=settings.ANTISPOOF_ENSEMBLE_METHOD,
                error_message=f"Inference error: {str(err)}",
            )

    predict = predict_liveness


# Global singleton instance
AntiSpoofManager = AntiSpoofingManager
antispoof_manager = AntiSpoofingManager()
