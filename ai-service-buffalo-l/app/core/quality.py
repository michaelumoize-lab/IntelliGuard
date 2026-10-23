import math
from typing import List, Optional, Tuple, Dict, Any
from dataclasses import dataclass, asdict
import numpy as np
import cv2


@dataclass
class FaceQualityResult:
    """Comprehensive biometric face quality evaluation metrics."""
    quality_score: float              # 0.0 to 1.0 composite score
    detection_confidence: float       # 0.0 to 1.0 InsightFace detection score
    sharpness_score: float            # 0.0 to 1.0 (Laplacian variance scaled)
    laplacian_var: float              # Raw variance of Laplacian
    brightness: float                 # Mean grayscale pixel intensity (0-255)
    brightness_score: float           # 0.0 to 1.0
    contrast: float                   # Standard deviation of grayscale pixel intensity
    face_width: float                 # Bounding box width in pixels
    face_height: float                # Bounding box height in pixels
    size_score: float                 # 0.0 to 1.0 relative to optimal 112x112
    pose_yaw: float                   # Estimated yaw angle in degrees (-90 to +90)
    pose_pitch: float                 # Estimated pitch angle in degrees (-90 to +90)
    pose_roll: float                  # Estimated roll angle in degrees (-180 to +180)
    pose_score: float                 # 0.0 to 1.0 based on head angle
    is_clipped: bool                  # Face intersects image frame boundary
    is_blurry: bool                   # Severe blur
    is_underexposed: bool             # Severely dark
    is_overexposed: bool              # Severely bright / washed out
    is_extreme_pose: bool             # Looking sideways or severe tilt
    is_too_small: bool                # Face smaller than minimum threshold
    issues: List[str]                 # Specific detected flaws
    guidance: Optional[str]           # Actionable human-readable guidance message

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def estimate_head_pose(kps) -> Tuple[float, float, float]:
    """Estimate head pose (yaw, pitch, roll in degrees) using 5-point facial landmarks.
    
    InsightFace 5 keypoints:
    0: right eye, 1: left eye, 2: nose tip, 3: right mouth corner, 4: left mouth corner.
    """
    if kps is None or len(kps) < 5:
        return 0.0, 0.0, 0.0

    try:
        re, le, nose, rm, lm = [np.array(pt, dtype=np.float64) for pt in kps[:5]]

        # 1. Roll: in-plane rotation angle of the eye baseline
        dx = float(le[0] - re[0])
        dy = float(le[1] - re[1])
        d_eyes = math.hypot(dx, dy)
        if d_eyes < 1e-4:
            return 0.0, 0.0, 0.0

        roll = math.degrees(math.atan2(dy, dx))
        ux, uy = dx / d_eyes, dy / d_eyes  # Unit vector along eye baseline

        # 2. Yaw: horizontal rotation (nose projection along eye baseline)
        mex = (re[0] + le[0]) / 2.0
        mey = (re[1] + le[1]) / 2.0
        proj_yaw = (nose[0] - mex) * ux + (nose[1] - mey) * uy
        yaw_ratio = proj_yaw / (d_eyes / 2.0)
        yaw = math.degrees(math.asin(max(-0.99, min(0.99, yaw_ratio))))

        # 3. Pitch: vertical tilt (nose offset along eye-to-mouth vector)
        mmx = (rm[0] + lm[0]) / 2.0
        mmy = (rm[1] + lm[1]) / 2.0
        d_em = math.hypot(mmx - mex, mmy - mey)
        if d_em > 1e-4:
            wx, wy = -uy, ux  # Unit vector perpendicular to eye baseline (pointing downwards)
            proj_pitch = (nose[0] - mex) * wx + (nose[1] - mey) * wy
            pitch_ratio = (proj_pitch - 0.55 * d_em) / d_em
            pitch = max(-90.0, min(90.0, pitch_ratio * 120.0))
        else:
            pitch = 0.0

        return round(float(yaw), 2), round(float(pitch), 2), round(float(roll), 2)
    except Exception:
        return 0.0, 0.0, 0.0


def assess_face_quality(img: np.ndarray, face) -> FaceQualityResult:
    """Evaluate image sharpness, brightness, size, pose, and frame positioning.
    
    Returns a structured FaceQualityResult with individual metrics and guidance.
    """
    img_h, img_w = img.shape[:2]

    # 1. Detection Confidence
    conf = float(face.det_score) if hasattr(face, "det_score") and face.det_score is not None else 0.5
    conf_score = max(0.0, min(1.0, conf))

    # 2. Face Resolution / Size
    if hasattr(face, "bbox") and face.bbox is not None and len(face.bbox) == 4:
        x1, y1, x2, y2 = [float(c) for c in face.bbox]
        face_w = max(1.0, x2 - x1)
        face_h = max(1.0, y2 - y1)
    else:
        x1, y1, x2, y2 = 0.0, 0.0, float(img_w), float(img_h)
        face_w = float(img_w)
        face_h = float(img_h)

    min_dim = min(face_w, face_h)
    size_score = min(1.0, min_dim / 112.0)
    is_too_small = min_dim < 50.0

    # 3. Border Clipping (Margin Check)
    margin = 3
    is_clipped = bool(x1 <= margin or y1 <= margin or x2 >= (img_w - margin) or y2 >= (img_h - margin))

    # 4. Crop Face Region for Pixel Analysis
    crop_x1 = max(0, int(x1))
    crop_y1 = max(0, int(y1))
    crop_x2 = min(img_w, int(x2))
    crop_y2 = min(img_h, int(y2))

    sharpness_score = 0.5
    laplacian_var = 50.0
    brightness = 120.0
    brightness_score = 0.8
    contrast = 40.0

    if (crop_x2 - crop_x1) > 8 and (crop_y2 - crop_y1) > 8:
        try:
            face_crop = img[crop_y1:crop_y2, crop_x1:crop_x2]
            gray_crop = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)

            # Sharpness via Laplacian Variance (smooth square-root scaling calibrated for webcams)
            laplacian_var = float(cv2.Laplacian(gray_crop, cv2.CV_64F).var())
            sharpness_score = min(1.0, math.sqrt(max(0.0, laplacian_var)) / math.sqrt(200.0))

            # Brightness & Exposure (Mean luminance)
            brightness = float(np.mean(gray_crop))
            contrast = float(np.std(gray_crop))

            if 65.0 <= brightness <= 185.0:
                brightness_score = 1.0
            elif brightness < 65.0:
                brightness_score = max(0.1, brightness / 65.0)
            else:
                brightness_score = max(0.1, (255.0 - brightness) / 70.0)
        except Exception:
            pass

    is_blurry = laplacian_var < 10.0
    is_underexposed = brightness < 30.0
    is_overexposed = brightness > 230.0

    # 5. Pose Estimation (Yaw, Pitch, Roll)
    kps = getattr(face, "kps", None)
    pose_yaw, pose_pitch, pose_roll = estimate_head_pose(kps)
    pose_dev = (abs(pose_yaw) / 50.0 + abs(pose_pitch) / 40.0 + abs(pose_roll) / 30.0) / 3.0
    pose_score = max(0.1, min(1.0, 1.0 - pose_dev))
    is_extreme_pose = abs(pose_yaw) > 42.0 or abs(pose_pitch) > 35.0

    # 6. Weighted Composite Quality Score
    composite = (
        (0.25 * conf_score)
        + (0.25 * sharpness_score)
        + (0.20 * size_score)
        + (0.15 * brightness_score)
        + (0.15 * pose_score)
    )

    if is_clipped:
        composite = max(0.0, composite - 0.10)

    quality_score = round(float(max(0.0, min(1.0, composite))), 4)

    # 7. Collect Specific Issues and Guidance
    issues: List[str] = []
    if is_underexposed:
        issues.append("Image is too dark")
    elif brightness < 50.0:
        issues.append("Image has dim lighting")

    if is_overexposed:
        issues.append("Image has severe glare or overexposure")
    elif brightness > 200.0:
        issues.append("Image has bright backlighting")

    if is_blurry:
        issues.append("Image is blurry")
    elif laplacian_var < 20.0:
        issues.append("Image has low sharpness")

    if is_extreme_pose:
        issues.append("Face is angled too far from camera")
    elif abs(pose_yaw) > 30.0 or abs(pose_pitch) > 25.0:
        issues.append("Face is not looking directly ahead")

    if is_too_small:
        issues.append("Face is too small in the frame")

    if is_clipped:
        issues.append("Face is partially cut off at frame border")

    # Formulate prioritized user guidance message
    guidance: Optional[str] = None
    if is_clipped:
        guidance = "Please center your face inside the camera frame."
    elif is_underexposed or brightness < 50.0:
        guidance = "Lighting is too dark. Please move to a brighter area."
    elif is_overexposed or brightness > 200.0:
        guidance = "Too much bright glare. Avoid direct backlighting."
    elif is_extreme_pose or abs(pose_yaw) > 30.0:
        guidance = "Please face the camera directly."
    elif is_blurry:
        guidance = "Image is blurry. Please hold steady."
    elif is_too_small:
        guidance = "Please move closer to the camera."
    elif quality_score < 0.50:
        guidance = "Face detected with low quality. Please face camera directly in good lighting."

    return FaceQualityResult(
        quality_score=quality_score,
        detection_confidence=round(conf_score, 4),
        sharpness_score=round(float(sharpness_score), 4),
        laplacian_var=round(float(laplacian_var), 2),
        brightness=round(float(brightness), 2),
        brightness_score=round(float(brightness_score), 4),
        contrast=round(float(contrast), 2),
        face_width=round(float(face_w), 2),
        face_height=round(float(face_h), 2),
        size_score=round(float(size_score), 4),
        pose_yaw=pose_yaw,
        pose_pitch=pose_pitch,
        pose_roll=pose_roll,
        pose_score=round(float(pose_score), 4),
        is_clipped=is_clipped,
        is_blurry=is_blurry,
        is_underexposed=is_underexposed,
        is_overexposed=is_overexposed,
        is_extreme_pose=is_extreme_pose,
        is_too_small=is_too_small,
        issues=issues,
        guidance=guidance,
    )


def calculate_face_quality_score(img: np.ndarray, face) -> float:
    """Calculate backward-compatible composite face quality score between 0.0 and 1.0."""
    result = assess_face_quality(img, face)
    return result.quality_score


def validate_registration_quality(img: np.ndarray, face) -> Tuple[bool, Optional[str], FaceQualityResult]:
    """Validate face image quality against strict registration criteria.
    
    Ensures that enrolled biometric reference vectors meet quality standards:
    - No severe underexposure (darkness) or overexposure (glare)
    - No severe motion blur
    - Frontal pose (yaw <= 45 deg, pitch <= 35 deg)
    - Face is not clipped at image borders
    - Sufficient face resolution (min_dim >= 50px)
    - Composite quality score >= 0.50
    
    Returns:
        Tuple of (is_valid: bool, rejection_reason: Optional[str], assessment: FaceQualityResult)
    """
    assessment = assess_face_quality(img, face)

    if assessment.is_clipped:
        return False, "Face is partially cut off at image boundary. Please center your face in the frame.", assessment

    if assessment.is_extreme_pose:
        return False, "Face angle is too extreme. Please look directly at the camera.", assessment

    if assessment.is_underexposed:
        return False, "Image is too dark for registration. Please ensure your face is well-lit.", assessment

    if assessment.is_overexposed:
        return False, "Image is overexposed or has severe glare. Avoid direct bright backlighting.", assessment

    if assessment.is_blurry:
        return False, "Face photo is too blurry for biometric enrollment. Please hold the camera steady.", assessment

    if assessment.is_too_small:
        return False, "Face is too small in the frame. Please move closer to the camera.", assessment

    if assessment.quality_score < 0.50:
        msg = assessment.guidance or "Face image quality is too low for registration. Please upload a clear, front-facing photo in good lighting."
        return False, msg, assessment

    return True, None, assessment
