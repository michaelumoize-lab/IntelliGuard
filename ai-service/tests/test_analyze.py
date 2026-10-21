import os
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    """Test client fixture initializing FastAPI lifespan."""
    with TestClient(app) as test_client:
        yield test_client


def test_analyze_no_person_blank_image(client: TestClient):
    """Scenario 1: Blank frame -> No Person Detected (InsightFace not called)."""
    blank = np.zeros((480, 640, 3), dtype=np.uint8)
    _, img_bytes = cv2.imencode(".jpg", blank)

    response = client.post(
        "/api/v1/analyze",
        files={"file": ("blank.jpg", img_bytes.tobytes(), "image/jpeg")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["status"] == "no_person"
    assert data["person_detected"] is False
    assert data["face_detected"] is False
    assert data["person_count"] == 0
    assert data["face_count"] == 0
    assert data["primary_person_bbox"] is None
    assert data["primary_face_bbox"] is None
    assert data["embedding"] is None
    assert data["image_width"] == 640
    assert data["image_height"] == 480
    assert "No person detected" in data["message"]


def test_analyze_valid_face_image(client: TestClient):
    """Scenario 4/5: Valid human face image -> Face Detected with ArcFace Embedding."""
    test_image_path = os.path.join(os.path.dirname(__file__), "..", "test.jpg")
    assert os.path.exists(test_image_path), f"Test image not found at {test_image_path}"

    with open(test_image_path, "rb") as f:
        response = client.post(
            "/api/v1/analyze",
            files={"file": ("test.jpg", f.read(), "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["person_detected"] is True
    assert data["face_detected"] is True
    assert data["status"] in ["face_detected_processing", "face_low_quality"]
    assert data["person_count"] >= 1
    assert data["face_count"] >= 1
    assert data["primary_person_bbox"] is not None
    assert len(data["primary_person_bbox"]) == 4

    if data["status"] == "face_detected_processing":
        assert data["embedding"] is not None
        assert len(data["embedding"]) == 512
        assert data["quality_score"] is not None
        assert data["quality_score"] >= 0.50


def test_analyze_person_no_face(client: TestClient, monkeypatch):
    """Scenario 2: Person detected by YOLO, but InsightFace detects no face."""
    from app.core.yolo import DetectedPersonData

    # Mock YOLO to return a person, but InsightFace to return no face
    def mock_detect(img, conf=None, iou=None):
        return [DetectedPersonData(bbox=[50.0, 50.0, 300.0, 500.0], confidence=0.92, is_primary=True)]

    class MockFaceApp:
        def get(self, img):
            return []

    yolo = client.app.state.yolo_detector
    orig_detect = yolo.detect
    orig_face_app = client.app.state.insightface_app

    try:
        yolo.detect = mock_detect
        client.app.state.insightface_app = MockFaceApp()

        blank = np.zeros((480, 640, 3), dtype=np.uint8)
        _, img_bytes = cv2.imencode(".jpg", blank)

        response = client.post(
            "/api/v1/analyze",
            files={"file": ("person_back.jpg", img_bytes.tobytes(), "image/jpeg")},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["status"] == "person_no_face"
        assert data["person_detected"] is True
        assert data["face_detected"] is False
        assert data["person_count"] == 1
        assert data["face_count"] == 0
        assert data["primary_person_bbox"] == [50.0, 50.0, 300.0, 500.0]
        assert data["embedding"] is None
        assert "no face visible" in data["message"].lower()
    finally:
        yolo.detect = orig_detect
        client.app.state.insightface_app = orig_face_app


def test_analyze_face_low_quality(client: TestClient, monkeypatch):
    """Scenario 3/10: Person and face detected, but quality/confidence is below 0.50 threshold."""
    from app.core.yolo import DetectedPersonData

    class MockFace:
        def __init__(self):
            self.bbox = np.array([100.0, 100.0, 150.0, 150.0])
            self.det_score = 0.35  # Below 0.50 threshold
            self.kps = None
            self.embedding = None

    def mock_detect(img, conf=None, iou=None):
        return [DetectedPersonData(bbox=[50.0, 50.0, 300.0, 500.0], confidence=0.88, is_primary=True)]

    class MockFaceApp:
        def get(self, img):
            return [MockFace()]

    yolo = client.app.state.yolo_detector
    orig_detect = yolo.detect
    orig_face_app = client.app.state.insightface_app

    try:
        yolo.detect = mock_detect
        client.app.state.insightface_app = MockFaceApp()

        blank = np.zeros((480, 640, 3), dtype=np.uint8)
        _, img_bytes = cv2.imencode(".jpg", blank)

        response = client.post(
            "/api/v1/analyze",
            files={"file": ("low_qual.jpg", img_bytes.tobytes(), "image/jpeg")},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["status"] == "face_low_quality"
        assert data["person_detected"] is True
        assert data["face_detected"] is True
        assert data["embedding"] is None
        assert "low quality" in data["message"].lower()
    finally:
        yolo.detect = orig_detect
        client.app.state.insightface_app = orig_face_app

