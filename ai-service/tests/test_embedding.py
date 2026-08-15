import os
import math
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


def test_embedding_health_check(client: TestClient):
    """Test that FastAPI health check endpoint confirms AI service model is loaded."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["model_loaded"] is True


def test_embedding_single_face(client: TestClient):
    """Test POST /api/v1/embedding with valid single-face image file upload."""
    test_image_path = os.path.join(os.path.dirname(__file__), "single_face.jpg")
    assert os.path.exists(test_image_path), f"Test image not found at {test_image_path}"

    with open(test_image_path, "rb") as img_file:
        response = client.post(
            "/api/v1/embedding",
            files={"file": ("single_face.jpg", img_file, "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["face_detected"] is True
    assert "embedding" in data
    assert isinstance(data["embedding"], list)
    assert data["model"] == "buffalo_s"


def test_embedding_dimensions(client: TestClient):
    """Test that returned embedding vector has exactly 512 numerical dimensions."""
    test_image_path = os.path.join(os.path.dirname(__file__), "single_face.jpg")
    with open(test_image_path, "rb") as img_file:
        response = client.post(
            "/api/v1/embedding",
            files={"file": ("single_face.jpg", img_file, "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["embedding_size"] == 512
    assert len(data["embedding"]) == 512
    assert all(isinstance(val, (float, int)) for val in data["embedding"])


def test_embedding_normalization(client: TestClient):
    """Test that returned embedding vector is L2 normalized (||v|| ≈ 1.0)."""
    test_image_path = os.path.join(os.path.dirname(__file__), "single_face.jpg")
    with open(test_image_path, "rb") as img_file:
        response = client.post(
            "/api/v1/embedding",
            files={"file": ("single_face.jpg", img_file, "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["normalized"] is True

    # Calculate L2 norm of returned vector
    vec = np.array(data["embedding"], dtype=np.float64)
    l2_norm = np.linalg.norm(vec)
    assert pytest.approx(l2_norm, abs=1e-3) == 1.0


def test_embedding_quality_score(client: TestClient):
    """Test that composite quality_score and detection_confidence are between 0.0 and 1.0."""
    test_image_path = os.path.join(os.path.dirname(__file__), "single_face.jpg")
    with open(test_image_path, "rb") as img_file:
        response = client.post(
            "/api/v1/embedding",
            files={"file": ("single_face.jpg", img_file, "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert "quality_score" in data
    assert 0.0 <= data["quality_score"] <= 1.0
    assert "detection_confidence" in data
    assert 0.0 <= data["detection_confidence"] <= 1.0


def test_embedding_zero_faces(client: TestClient):
    """Test POST /api/v1/embedding with an image containing 0 faces (rejected with 400)."""
    # Create a solid black image with no face
    blank_img = np.zeros((200, 200, 3), dtype=np.uint8)
    _, img_bytes = cv2.imencode(".jpg", blank_img)

    response = client.post(
        "/api/v1/embedding",
        files={"file": ("blank.jpg", img_bytes.tobytes(), "image/jpeg")},
    )
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "No face detected" in data["detail"]


def test_embedding_multiple_faces(client: TestClient):
    """Test POST /api/v1/embedding with an image containing >1 faces (multi_face.jpg contains 2 faces)."""
    test_image_path = os.path.join(os.path.dirname(__file__), "multi_face.jpg")
    with open(test_image_path, "rb") as img_file:
        response = client.post(
            "/api/v1/embedding",
            files={"file": ("multi_face.jpg", img_file, "image/jpeg")},
        )
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "Multiple faces detected" in data["detail"] or "Exactly one face is required" in data["detail"]


def test_embedding_empty_upload(client: TestClient):
    """Test POST /api/v1/embedding with an empty 0-byte file (rejected with 400)."""
    response = client.post(
        "/api/v1/embedding",
        files={"file": ("empty.jpg", b"", "image/jpeg")},
    )
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data


def test_embedding_invalid_file(client: TestClient):
    """Test POST /api/v1/embedding with non-image file bytes (rejected with 400)."""
    response = client.post(
        "/api/v1/embedding",
        files={"file": ("test.txt", b"This is invalid text data", "text/plain")},
    )
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data


def test_embedding_consistency(client: TestClient):
    """Test that sending the exact same face image twice produces deterministic identical embeddings."""
    test_image_path = os.path.join(os.path.dirname(__file__), "single_face.jpg")
    
    with open(test_image_path, "rb") as img_file:
        res1 = client.post(
            "/api/v1/embedding",
            files={"file": ("single_face.jpg", img_file, "image/jpeg")},
        )
    assert res1.status_code == 200
    vec1 = np.array(res1.json()["embedding"], dtype=np.float64)

    with open(test_image_path, "rb") as img_file:
        res2 = client.post(
            "/api/v1/embedding",
            files={"file": ("single_face.jpg", img_file, "image/jpeg")},
        )
    assert res2.status_code == 200
    vec2 = np.array(res2.json()["embedding"], dtype=np.float64)

    # Cosine similarity between identical face inferences must equal 1.0
    cosine_sim = np.dot(vec1, vec2)
    assert pytest.approx(cosine_sim, abs=1e-4) == 1.0
