import os
import io
import base64
import numpy as np
import cv2
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    """Test client fixture that triggers FastAPI lifespan startup/shutdown."""
    with TestClient(app) as test_client:
        yield test_client


def test_health_check(client: TestClient):
    """Test that health check endpoint returns 200 and model loaded status."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["model_loaded"] is True


def test_detect_faces_file_upload(client: TestClient):
    """Test POST /api/v1/detect with valid test image upload."""
    test_image_path = os.path.join(os.path.dirname(__file__), "..", "test.jpg")
    assert os.path.exists(test_image_path), f"Test image not found at {test_image_path}"

    with open(test_image_path, "rb") as img_file:
        response = client.post(
            "/api/v1/detect",
            files={"file": ("test.jpg", img_file, "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["face_count"] >= 1
    assert len(data["faces"]) == data["face_count"]

    first_face = data["faces"][0]
    assert "bbox" in first_face
    assert len(first_face["bbox"]) == 4
    assert "confidence" in first_face
    assert first_face["confidence"] > 0.5
    assert "landmarks" in first_face
    assert len(first_face["landmarks"]) == 5


def test_detect_faces_base64(client: TestClient):
    """Test POST /api/v1/detect/base64 with base64 encoded image."""
    test_image_path = os.path.join(os.path.dirname(__file__), "..", "test.jpg")
    with open(test_image_path, "rb") as img_file:
        encoded = base64.b64encode(img_file.read()).decode("utf-8")

    payload = {"image_base64": f"data:image/jpeg;base64,{encoded}"}
    response = client.post("/api/v1/detect/base64", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["face_count"] >= 1
    assert len(data["faces"]) == data["face_count"]


def test_detect_faces_zero_faces(client: TestClient):
    """Test POST /api/v1/detect with a valid image containing no faces."""
    # Create a solid black 200x200 image
    blank_img = np.zeros((200, 200, 3), dtype=np.uint8)
    _, img_bytes = cv2.imencode(".jpg", blank_img)

    response = client.post(
        "/api/v1/detect",
        files={"file": ("blank.jpg", img_bytes.tobytes(), "image/jpeg")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["face_count"] == 0
    assert data["faces"] == []


def test_detect_faces_empty_upload(client: TestClient):
    """Test POST /api/v1/detect with an empty 0-byte file."""
    response = client.post(
        "/api/v1/detect",
        files={"file": ("empty.jpg", b"", "image/jpeg")},
    )
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "Empty image" in data["detail"] or "invalid" in data["detail"].lower()


def test_detect_faces_invalid_file(client: TestClient):
    """Test POST /api/v1/detect with non-image file bytes."""
    response = client.post(
        "/api/v1/detect",
        files={"file": ("test.txt", b"This is invalid text image content", "text/plain")},
    )
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data


def test_detect_faces_payload_size_limit(client: TestClient):
    """Test POST /api/v1/detect with oversized payload exceeding 10MB limit."""
    oversized_bytes = b"0" * (10 * 1024 * 1024 + 1)
    response = client.post(
        "/api/v1/detect",
        files={"file": ("large.jpg", oversized_bytes, "image/jpeg")},
    )
    assert response.status_code == 400
    data = response.json()
    assert "exceeds the maximum allowed limit" in data["detail"]


def test_detect_faces_dimension_limit(client: TestClient):
    """Test POST /api/v1/detect with image dimensions exceeding 4096px limit."""
    # Create synthetic image with 4097x10 dimensions
    large_dim_img = np.zeros((10, 4097, 3), dtype=np.uint8)
    _, img_bytes = cv2.imencode(".jpg", large_dim_img)

    response = client.post(
        "/api/v1/detect",
        files={"file": ("large_dim.jpg", img_bytes.tobytes(), "image/jpeg")},
    )
    assert response.status_code == 400
    data = response.json()
    assert "exceed maximum allowed limit" in data["detail"]

