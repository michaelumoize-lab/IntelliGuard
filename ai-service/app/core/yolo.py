import os
import urllib.request
import hashlib
import logging
from typing import Optional, List, Tuple, Dict, Any
import numpy as np
import cv2
import onnxruntime as ort

from app.core.config import settings

logger = logging.getLogger("intelliguard.yolo")


def ensure_yolo_model(
    model_name: str = settings.YOLO_MODEL_NAME,
    model_url: str = settings.YOLO_MODEL_URL,
    expected_checksum: Optional[str] = settings.YOLO_CHECKSUM,
) -> str:
    """Ensure YOLO ONNX model weights exist locally with valid checksum.
    
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
        logger.info(f"YOLO model '{model_name}.onnx' verified in local cache: {model_path}")
        return model_path

    logger.info(f"Downloading YOLO model '{model_name}.onnx' from {model_url}...")
    temp_path = f"{model_path}.tmp"
    req = urllib.request.Request(model_url, headers={"User-Agent": "IntelliGuard/1.0"})
    
    with urllib.request.urlopen(req, timeout=60) as response, open(temp_path, "wb") as out_file:
        while chunk := response.read(65536):
            out_file.write(chunk)

    if not _verify_checksum(temp_path):
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise ValueError(f"Downloaded YOLO model failed checksum verification ({expected_checksum}).")

    if os.path.exists(model_path):
        os.remove(model_path)
    os.rename(temp_path, model_path)

    logger.info(f"YOLO model successfully saved to {model_path}")
    return model_path


class DetectedPersonData:
    """Lightweight representation of a person detection."""
    def __init__(self, bbox: List[float], confidence: float, is_primary: bool = False):
        self.bbox = bbox  # [x1, y1, x2, y2] in original pixel coordinates
        self.confidence = confidence
        self.is_primary = is_primary

    def to_dict(self) -> Dict[str, Any]:
        return {
            "bbox": self.bbox,
            "confidence": self.confidence,
            "is_primary": self.is_primary,
        }


class YoloPersonDetector:
    """ONNX-based YOLO detector specialized for COCO Class 0 (Person)."""

    def __init__(
        self,
        model_name: str = settings.YOLO_MODEL_NAME,
        conf_threshold: float = settings.YOLO_CONFIDENCE_THRESHOLD,
        iou_threshold: float = settings.YOLO_IOU_THRESHOLD,
    ) -> None:
        self.model_name = model_name
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self.session: Optional[ort.InferenceSession] = None
        self.is_loaded: bool = False
        self.error_message: Optional[str] = None
        self.input_name: str = "images"
        self.input_shape: Tuple[int, int] = (640, 640)  # (height, width)

    def initialize(self) -> bool:
        """Initialize the ONNX Runtime session for YOLO."""
        if self.is_loaded and self.session is not None:
            return True

        try:
            model_path = ensure_yolo_model(self.model_name)

            available_providers = ort.get_available_providers()
            providers: List[str] = []
            if "CUDAExecutionProvider" in available_providers:
                providers.append("CUDAExecutionProvider")
            providers.append("CPUExecutionProvider")

            sess_options = ort.SessionOptions()
            sess_options.intra_op_num_threads = 1
            sess_options.inter_op_num_threads = 1
            sess_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
            sess_options.enable_cpu_mem_arena = False

            self.session = ort.InferenceSession(
                model_path,
                sess_options=sess_options,
                providers=providers,
            )

            # Inspect input shape
            inputs = self.session.get_inputs()
            if inputs:
                self.input_name = inputs[0].name
                shape = inputs[0].shape
                if len(shape) == 4 and isinstance(shape[2], int) and isinstance(shape[3], int):
                    self.input_shape = (shape[2], shape[3])

            self.is_loaded = True
            self.error_message = None
            logger.info(f"YOLO Person Detector loaded ({self.model_name}, input={self.input_shape}).")
            return True
        except Exception as e:
            self.is_loaded = False
            self.session = None
            self.error_message = str(e)
            logger.error(f"Failed to initialize YOLO detector: {e}", exc_info=True)
            return False

    def _letterbox(
        self,
        img: np.ndarray,
        target_shape: Tuple[int, int] = (640, 640),
    ) -> Tuple[np.ndarray, float, Tuple[float, float]]:
        """Resize image with constant aspect ratio and symmetric padding."""
        orig_h, orig_w = img.shape[:2]
        target_h, target_w = target_shape

        scale = min(target_w / orig_w, target_h / orig_h)
        new_w = int(round(orig_w * scale))
        new_h = int(round(orig_h * scale))

        resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

        pad_w = (target_w - new_w) / 2
        pad_h = (target_h - new_h) / 2

        top = int(round(pad_h - 0.1))
        bottom = int(round(pad_h + 0.1))
        left = int(round(pad_w - 0.1))
        right = int(round(pad_w + 0.1))

        # Pad with neutral gray (114)
        padded = cv2.copyMakeBorder(
            resized, top, bottom, left, right, cv2.BORDER_CONSTANT, value=(114, 114, 114)
        )

        return padded, scale, (pad_w, pad_h)

    def detect(
        self,
        img: np.ndarray,
        conf_threshold: Optional[float] = None,
        iou_threshold: Optional[float] = None,
    ) -> List[DetectedPersonData]:
        """Detect person bounding boxes in the input OpenCV BGR image."""
        if not self.is_loaded or self.session is None:
            raise RuntimeError(f"YOLO model is not initialized: {self.error_message}")

        conf_thresh = conf_threshold if conf_threshold is not None else self.conf_threshold
        iou_thresh = iou_threshold if iou_threshold is not None else self.iou_threshold

        orig_h, orig_w = img.shape[:2]
        padded, scale, (pad_w, pad_h) = self._letterbox(img, self.input_shape)

        # Convert BGR to RGB, normalize [0, 1], transpose to [1, 3, H, W]
        rgb = cv2.cvtColor(padded, cv2.COLOR_BGR2RGB)
        input_tensor = rgb.astype(np.float32) / 255.0
        input_tensor = np.transpose(input_tensor, (2, 0, 1))
        input_tensor = np.expand_dims(input_tensor, axis=0)

        # Run inference
        outputs = self.session.run(None, {self.input_name: input_tensor})
        raw_output = outputs[0]  # shape: [1, 84, 8400] or [1, num_features, num_proposals]

        # Squeeze batch dimension: [84, 8400] -> transpose to [8400, 84]
        predictions = np.squeeze(raw_output, axis=0).T

        boxes: List[List[int]] = []
        scores: List[float] = []

        # YOLOv8 format: columns 0-3 are [cx, cy, w, h], column 4 is class 0 (person)
        # Check if predictions have at least 5 columns
        if predictions.shape[1] < 5:
            return []

        cx = predictions[:, 0]
        cy = predictions[:, 1]
        w = predictions[:, 2]
        h = predictions[:, 3]
        person_scores = predictions[:, 4]

        mask = person_scores >= conf_thresh
        if not np.any(mask):
            return []

        cx = cx[mask]
        cy = cy[mask]
        w = w[mask]
        h = h[mask]
        filtered_scores = person_scores[mask]

        # Convert letterboxed [cx, cy, w, h] to original pixel [x1, y1, w, h]
        for c_x, c_y, box_w, box_h, score in zip(cx, cy, w, h, filtered_scores):
            x1 = (c_x - box_w / 2.0 - pad_w) / scale
            y1 = (c_y - box_h / 2.0 - pad_h) / scale
            x2 = (c_x + box_w / 2.0 - pad_w) / scale
            y2 = (c_y + box_h / 2.0 - pad_h) / scale

            # Clamp coordinates
            x1 = max(0.0, min(float(orig_w), x1))
            y1 = max(0.0, min(float(orig_h), y1))
            x2 = max(0.0, min(float(orig_w), x2))
            y2 = max(0.0, min(float(orig_h), y2))

            box_width = x2 - x1
            box_height = y2 - y1

            if box_width > 5 and box_height > 5:
                # NMSBoxes expects [x, y, w, h] as ints
                boxes.append([int(round(x1)), int(round(y1)), int(round(box_width)), int(round(box_height))])
                scores.append(float(score))

        if not boxes:
            return []

        indices = cv2.dnn.NMSBoxes(boxes, scores, conf_thresh, iou_thresh)
        if len(indices) == 0:
            return []

        detected_persons: List[DetectedPersonData] = []
        for idx in indices.flatten():
            b = boxes[idx]
            x1 = float(b[0])
            y1 = float(b[1])
            x2 = float(b[0] + b[2])
            y2 = float(b[1] + b[3])
            conf = round(float(scores[idx]), 4)
            detected_persons.append(
                DetectedPersonData(
                    bbox=[round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2)],
                    confidence=conf,
                    is_primary=False,
                )
            )

        if not detected_persons:
            return []

        # Sort by bounding box area (width * height) descending and mark primary subject
        detected_persons.sort(
            key=lambda p: (p.bbox[2] - p.bbox[0]) * (p.bbox[3] - p.bbox[1]),
            reverse=True,
        )
        detected_persons[0].is_primary = True

        return detected_persons


# Singleton detector instance
yolo_detector = YoloPersonDetector()
