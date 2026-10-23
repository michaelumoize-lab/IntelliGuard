import os
import math
import cv2
import numpy as np
import pytest
from app.core.quality import (
    assess_face_quality,
    calculate_face_quality_score,
    estimate_head_pose,
    validate_registration_quality,
    FaceQualityResult,
)


class DummyFace:
    """Mock InsightFace Face object for synthetic unit testing."""
    def __init__(
        self,
        bbox=(50.0, 50.0, 200.0, 200.0),
        det_score=0.90,
        kps=None,
    ):
        self.bbox = np.array(bbox, dtype=np.float32)
        self.det_score = det_score
        # Default frontal keypoints: re, le, nose, rm, lm
        if kps is None:
            self.kps = np.array(
                [
                    [100.0, 100.0],  # Right eye
                    [150.0, 100.0],  # Left eye
                    [125.0, 125.0],  # Nose tip
                    [105.0, 150.0],  # Right mouth
                    [145.0, 150.0],  # Left mouth
                ],
                dtype=np.float32,
            )
        else:
            self.kps = np.array(kps, dtype=np.float32)


def test_estimate_head_pose_frontal():
    """Frontal symmetric keypoints should yield approx 0 yaw, 0 pitch, 0 roll."""
    face = DummyFace()
    yaw, pitch, roll = estimate_head_pose(face.kps)
    assert abs(roll) < 5.0
    assert abs(yaw) < 10.0
    assert abs(pitch) < 15.0


def test_estimate_head_pose_tilted_roll():
    """Tilted eyes should correctly estimate roll angle."""
    kps = [
        [100.0, 90.0],   # Right eye higher
        [150.0, 110.0],  # Left eye lower (clockwise roll)
        [125.0, 125.0],
        [105.0, 150.0],
        [145.0, 150.0],
    ]
    yaw, pitch, roll = estimate_head_pose(kps)
    # dx=50, dy=20 -> atan2(20, 50) ~= 21.8 degrees
    assert 18.0 <= roll <= 25.0


def test_assess_face_quality_normal_image():
    """A clear synthetic image with high variance and good lighting should get high quality score."""
    img = np.full((300, 300, 3), 128, dtype=np.uint8)
    # Add high-frequency texture to face region for sharpness
    cv2.rectangle(img, (60, 60), (190, 190), (255, 255, 255), 2)
    cv2.circle(img, (100, 100), 10, (0, 0, 0), -1)
    cv2.circle(img, (150, 100), 10, (0, 0, 0), -1)
    cv2.circle(img, (125, 125), 8, (50, 50, 50), -1)
    cv2.line(img, (105, 150), (145, 150), (0, 0, 0), 3)

    face = DummyFace(bbox=[50.0, 50.0, 200.0, 200.0], det_score=0.95)
    res = assess_face_quality(img, face)

    assert isinstance(res, FaceQualityResult)
    assert res.quality_score >= 0.50
    assert not res.is_underexposed
    assert not res.is_overexposed
    assert not res.is_clipped
    assert not res.is_too_small


def test_validate_registration_underexposed_rejected():
    """Completely black image should be rejected for registration."""
    dark_img = np.zeros((300, 300, 3), dtype=np.uint8)
    face = DummyFace(bbox=[50.0, 50.0, 200.0, 200.0], det_score=0.85)

    is_valid, reason, assessment = validate_registration_quality(dark_img, face)
    assert is_valid is False
    assert assessment.is_underexposed is True
    assert "dark" in reason.lower()


def test_validate_registration_overexposed_rejected():
    """Overexposed bright white image should be rejected for registration."""
    bright_img = np.full((300, 300, 3), 245, dtype=np.uint8)
    face = DummyFace(bbox=[50.0, 50.0, 200.0, 200.0], det_score=0.85)

    is_valid, reason, assessment = validate_registration_quality(bright_img, face)
    assert is_valid is False
    assert assessment.is_overexposed is True
    assert "overexposed" in reason.lower() or "glare" in reason.lower()


def test_validate_registration_clipped_border_rejected():
    """Face bounding box cut off at boundary (x1=0) should be rejected for registration."""
    img = np.full((300, 300, 3), 120, dtype=np.uint8)
    face = DummyFace(bbox=[0.0, 50.0, 150.0, 200.0], det_score=0.90)

    is_valid, reason, assessment = validate_registration_quality(img, face)
    assert is_valid is False
    assert assessment.is_clipped is True
    assert "cut off" in reason.lower() or "border" in reason.lower()


def test_validate_registration_extreme_pose_rejected():
    """Extreme yaw profile keypoints should be rejected for registration."""
    img = np.full((300, 300, 3), 120, dtype=np.uint8)
    cv2.rectangle(img, (60, 60), (190, 190), (255, 255, 255), 2)
    cv2.circle(img, (100, 100), 10, (0, 0, 0), -1)
    # Nose far beyond left eye -> extreme yaw profile
    kps = [
        [100.0, 100.0],  # Right eye
        [130.0, 100.0],  # Left eye (d_eyes = 30)
        [160.0, 120.0],  # Nose way out to the right side (turned far left)
        [110.0, 140.0],
        [135.0, 140.0],
    ]
    face = DummyFace(bbox=[50.0, 50.0, 200.0, 200.0], det_score=0.90, kps=kps)

    is_valid, reason, assessment = validate_registration_quality(img, face)
    assert is_valid is False
    assert assessment.is_extreme_pose is True
    assert "angle" in reason.lower() or "face the camera" in reason.lower()


def test_real_single_face_passes_registration():
    """The genuine reference single_face.jpg must pass registration criteria."""
    image_path = os.path.join(os.path.dirname(__file__), "single_face.jpg")
    img = cv2.imread(image_path)
    assert img is not None

    # Load real face from insightface
    from app.core.insightface import InsightFaceManager
    manager = InsightFaceManager()
    manager.initialize()
    faces = manager.app.get(img)
    assert len(faces) == 1

    is_valid, reason, assessment = validate_registration_quality(img, faces[0])
    assert is_valid is True, f"Failed with reason: {reason}"
    assert assessment.quality_score >= 0.50
    assert not assessment.is_clipped
    assert not assessment.is_underexposed
    assert not assessment.is_overexposed
