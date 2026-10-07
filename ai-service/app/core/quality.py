import math
import numpy as np
import cv2


def calculate_face_quality_score(img: np.ndarray, face) -> float:
    """Calculate a practical face quality score between 0.0 and 1.0.
    
    Combines:
    1. Detection confidence (weight: 40%)
    2. Face resolution/size factor relative to 112x112 minimum optimal crop (weight: 30%)
    3. Image sharpness using Laplacian variance on cropped face (weight: 30%)
    """
    # 1. Detection confidence factor
    confidence = float(face.det_score) if hasattr(face, "det_score") and face.det_score is not None else 0.5
    confidence_score = max(0.0, min(1.0, confidence))

    # 2. Size / resolution factor
    img_h, img_w = img.shape[:2]
    if hasattr(face, "bbox") and face.bbox is not None and len(face.bbox) == 4:
        x1, y1, x2, y2 = [float(c) for c in face.bbox]
        face_w = max(1.0, x2 - x1)
        face_h = max(1.0, y2 - y1)
        # Optimal face crop width for ArcFace recognition model is 112x112
        min_dim = min(face_w, face_h)
        size_score = min(1.0, min_dim / 112.0)
    else:
        x1, y1, x2, y2 = 0.0, 0.0, float(img_w), float(img_h)
        size_score = 0.5

    # 3. Sharpness / Blur factor via Laplacian variance
    sharpness_score = 0.5
    try:
        # Clamp crop coordinates to image boundaries
        crop_x1 = max(0, int(x1))
        crop_y1 = max(0, int(y1))
        crop_x2 = min(img_w, int(x2))
        crop_y2 = min(img_h, int(y2))

        if (crop_x2 - crop_x1) > 10 and (crop_y2 - crop_y1) > 10:
            face_crop = img[crop_y1:crop_y2, crop_x1:crop_x2]
            gray_crop = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
            laplacian_var = cv2.Laplacian(gray_crop, cv2.CV_64F).var()
            # Variance >= 300 is considered good sharpness; scale to 1.0 max
            sharpness_score = min(1.0, laplacian_var / 300.0)
    except Exception:
        sharpness_score = 0.5

    # Weighted composite quality score
    composite_score = (0.4 * confidence_score) + (0.3 * size_score) + (0.3 * sharpness_score)
    return round(float(max(0.0, min(1.0, composite_score))), 4)
