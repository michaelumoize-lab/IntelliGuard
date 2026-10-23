import os
import io
import base64
import hashlib
import numpy as np
import cv2
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.anti_spoofing import (
    AntiSpoofingManager,
    AntiSpoofResult,
    crop_face_for_model,
    softmax,
    ensure_anti_spoof_weights,
    TRUSTED_CHECKSUMS,
    MODEL_SCALES,
)


@pytest.fixture(scope="module")
def client():
    """Test client fixture initializing FastAPI lifespan."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def sample_image():
    """Create a synthetic 480x640 BGR image for geometric testing."""
    img = np.full((480, 640, 3), 128, dtype=np.uint8)
    # Draw simple facial feature landmarks
    cv2.circle(img, (320, 240), 80, (200, 200, 200), -1)
    cv2.circle(img, (290, 220), 10, (50, 50, 50), -1)
    cv2.circle(img, (350, 220), 10, (50, 50, 50), -1)
    return img


@pytest.fixture(scope="module")
def real_face_image():
    """Load an existing real face image from the tests or project folder."""
    candidates = [
        os.path.join(os.path.dirname(__file__), "single_face.jpg"),
        os.path.join(os.path.dirname(__file__), "..", "michael.JPG"),
        os.path.join(os.path.dirname(__file__), "..", "test.jpg"),
    ]
    for p in candidates:
        if os.path.exists(p):
            img = cv2.imread(p)
            if img is not None:
                return img
    # Fallback synthetic face
    fallback = np.full((480, 640, 3), 180, dtype=np.uint8)
    return fallback


# =========================================================================
# 1. Image Preprocessing & Dynamic Crop Tests (Geometry & Boundary Clipping)
# =========================================================================

def test_crop_face_standard_dimensions(sample_image):
    """Test standard face crop for MiniFASNetV2 (scale 2.7) produces exactly (80, 80, 3)."""
    bbox = [240.0, 160.0, 400.0, 320.0]
    crop = crop_face_for_model(sample_image, bbox, scale=2.7, target_size=(80, 80))
    assert crop.shape == (80, 80, 3)
    assert crop.dtype == np.uint8


def test_crop_face_scale_4_dimensions(sample_image):
    """Test wider face crop for MiniFASNetV1SE (scale 4.0) produces exactly (80, 80, 3)."""
    bbox = [240.0, 160.0, 400.0, 320.0]
    crop = crop_face_for_model(sample_image, bbox, scale=4.0, target_size=(80, 80))
    assert crop.shape == (80, 80, 3)
    assert crop.dtype == np.uint8


def test_crop_face_boundary_clipping_top_left(sample_image):
    """Test boundary-aware dynamic scaling when face bounding box touches image origin (0, 0)."""
    bbox = [0.0, 0.0, 150.0, 150.0]
    crop = crop_face_for_model(sample_image, bbox, scale=2.7, target_size=(80, 80))
    assert crop.shape == (80, 80, 3)


def test_crop_face_boundary_clipping_bottom_right(sample_image):
    """Test boundary clipping when face bounding box touches bottom-right boundary."""
    h, w = sample_image.shape[:2]
    bbox = [float(w - 120), float(h - 120), float(w - 1), float(h - 1)]
    crop = crop_face_for_model(sample_image, bbox, scale=4.0, target_size=(80, 80))
    assert crop.shape == (80, 80, 3)


def test_crop_face_invalid_box_coordinates(sample_image):
    """Test that inverted or degenerate bounding boxes raise ValueError."""
    with pytest.raises(ValueError, match="Invalid bounding box coordinates"):
        crop_face_for_model(sample_image, [300.0, 300.0, 200.0, 200.0], scale=2.7)


def test_crop_face_empty_image():
    """Test that empty or None image array raises ValueError."""
    empty_img = np.array([], dtype=np.uint8)
    with pytest.raises(ValueError, match="empty or None"):
        crop_face_for_model(empty_img, [10.0, 10.0, 50.0, 50.0], scale=2.7)


# =========================================================================
# 2. Mathematical Stability Tests (Softmax & Normalization)
# =========================================================================

def test_softmax_numerical_stability():
    """Test numerically stable softmax with large positive and negative logits."""
    large_logits = np.array([[1000.0, 1001.0, 999.0]], dtype=np.float32)
    probs = softmax(large_logits)
    assert not np.isnan(probs).any(), "Softmax produced NaN on large inputs"
    assert not np.isinf(probs).any(), "Softmax produced Inf on large inputs"
    assert np.isclose(np.sum(probs), 1.0, atol=1e-5), "Softmax probabilities must sum to 1.0"


def test_softmax_probability_ordering():
    """Test that higher logit yields higher probability in output distribution."""
    logits = np.array([[2.5, 6.8, -1.2]], dtype=np.float32)
    probs = softmax(logits)
    assert probs[0, 1] > probs[0, 0] > probs[0, 2]
    assert np.isclose(np.sum(probs), 1.0, atol=1e-5)


# =========================================================================
# 3. Model Integrity & Checksum Verification Tests
# =========================================================================

def test_trusted_checksums_definition():
    """Test that trusted checksums for MiniFASNetV2 and MiniFASNetV1SE are configured."""
    assert "MiniFASNetV2" in TRUSTED_CHECKSUMS
    assert "MiniFASNetV1SE" in TRUSTED_CHECKSUMS
    assert len(TRUSTED_CHECKSUMS["MiniFASNetV2"]) == 64
    assert len(TRUSTED_CHECKSUMS["MiniFASNetV1SE"]) == 64


def test_checksum_mismatch_rejection(tmp_path):
    """Test that invalid file contents fail SHA256 integrity verification."""
    fake_model = tmp_path / "corrupted_model.onnx"
    fake_model.write_bytes(b"corrupted invalid weights content")
    
    with pytest.raises(ValueError, match="Checksum mismatch"):
        ensure_anti_spoof_weights(
            model_name="MiniFASNetV2",
            custom_path=str(fake_model),
            expected_checksum="0000000000000000000000000000000000000000000000000000000000000000",
        )


# =========================================================================
# 4. AntiSpoofResult & Tri-State Classification Decision Logic
# =========================================================================

def test_antispoof_result_structure():
    """Test that AntiSpoofResult dataclass serializes cleanly with all required fields."""
    res = AntiSpoofResult(
        status="live",
        is_live=True,
        live_score=0.982,
        live_threshold=0.80,
        spoof_threshold=0.45,
        individual_scores={"MiniFASNetV2": 0.98, "MiniFASNetV1SE": 0.984},
        processing_time_ms=18.5,
        model="MiniFASNetV2+MiniFASNetV1SE",
        ensemble_method="mean",
    )
    d = res.to_dict()
    assert d["status"] == "live"
    assert d["is_live"] is True
    assert d["live_score"] == 0.982
    assert d["threshold"] == 0.80
    assert d["ensemble_method"] == "mean"
    assert d["individual_scores"]["MiniFASNetV2"] == 0.98


def test_decision_logic_live_threshold(monkeypatch):
    """Test that an ensemble score >= live_threshold is classified as 'live' by predict_liveness."""
    mgr = AntiSpoofingManager()
    mgr.is_loaded = True
    mgr.session_v2 = object()
    mgr.session_v1se = object()

    def mock_infer(*args, **kwargs):
        return 0.85

    monkeypatch.setattr(mgr, "_infer_single_model", mock_infer)
    dummy_img = np.zeros((100, 100, 3), dtype=np.uint8)
    res = mgr.predict_liveness(dummy_img, [10.0, 10.0, 80.0, 80.0])
    assert res.status == "live"
    assert res.is_live is True
    assert res.live_score == 0.85


def test_decision_logic_spoof_threshold(monkeypatch):
    """Test that an ensemble score < spoof_threshold is classified as 'spoof_detected' by predict_liveness."""
    mgr = AntiSpoofingManager()
    mgr.is_loaded = True
    mgr.session_v2 = object()
    mgr.session_v1se = object()

    def mock_infer(*args, **kwargs):
        return 0.30

    monkeypatch.setattr(mgr, "_infer_single_model", mock_infer)
    dummy_img = np.zeros((100, 100, 3), dtype=np.uint8)
    res = mgr.predict_liveness(dummy_img, [10.0, 10.0, 80.0, 80.0])
    assert res.status == "spoof_detected"
    assert res.is_live is False
    assert res.live_score == 0.30


def test_decision_logic_inconclusive_threshold(monkeypatch):
    """Test that an ensemble score in [spoof_threshold, live_threshold) is 'inconclusive' by predict_liveness."""
    mgr = AntiSpoofingManager()
    mgr.is_loaded = True
    mgr.session_v2 = object()
    mgr.session_v1se = object()

    # Exact lower boundary: score == 0.45 should be inconclusive (not spoof, since comparison is < 0.45)
    def mock_infer_boundary(*args, **kwargs):
        return 0.45

    monkeypatch.setattr(mgr, "_infer_single_model", mock_infer_boundary)
    dummy_img = np.zeros((100, 100, 3), dtype=np.uint8)
    res_boundary = mgr.predict_liveness(dummy_img, [10.0, 10.0, 80.0, 80.0])
    assert res_boundary.status == "inconclusive"
    assert res_boundary.is_live is False
    assert res_boundary.live_score == 0.45

    # Mid-range uncertainty
    def mock_infer_mid(*args, **kwargs):
        return 0.65

    monkeypatch.setattr(mgr, "_infer_single_model", mock_infer_mid)
    res_mid = mgr.predict_liveness(dummy_img, [10.0, 10.0, 80.0, 80.0])
    assert res_mid.status == "inconclusive"
    assert res_mid.is_live is False
    assert res_mid.live_score == 0.65


# =========================================================================
# 5. AntiSpoofingManager Engine Tests (Initialization & Inference)
# =========================================================================

def test_manager_initialization():
    """Test that AntiSpoofingManager successfully initializes and loads ONNX models."""
    mgr = AntiSpoofingManager()
    success = mgr.initialize()
    assert success is True
    assert mgr.is_loaded is True
    assert mgr.session_v2 is not None
    assert mgr.session_v1se is not None
    assert mgr.active_provider in ["CPUExecutionProvider", "CUDAExecutionProvider"]


def test_manager_inference_on_face(real_face_image):
    """Test real inference execution returning valid AntiSpoofResult."""
    mgr = AntiSpoofingManager()
    mgr.initialize()

    h, w = real_face_image.shape[:2]
    bbox = [w * 0.2, h * 0.2, w * 0.8, h * 0.8]

    res = mgr.predict_liveness(real_face_image, bbox)
    assert isinstance(res, AntiSpoofResult)
    assert res.status in ["live", "spoof_detected", "inconclusive"]
    assert 0.0 <= res.live_score <= 1.0
    assert "MiniFASNetV2" in res.individual_scores
    assert "MiniFASNetV1SE" in res.individual_scores
    assert res.processing_time_ms > 0.0


def test_manager_inference_when_unloaded_fails_safely(sample_image):
    """Test that predict_liveness fails safely with status='error' when models are unloaded."""
    mgr = AntiSpoofingManager()
    mgr.is_loaded = False
    mgr.session_v2 = None
    mgr.session_v1se = None

    res = mgr.predict_liveness(sample_image, [50.0, 50.0, 150.0, 150.0])
    assert res.status == "error"
    assert res.is_live is False
    assert res.live_score == 0.0
    assert res.error_message is not None


# =========================================================================
# 6. FastAPI Endpoint Integration Tests (/api/v1/liveness)
# =========================================================================

def test_api_liveness_endpoint_file_upload(client: TestClient, real_face_image):
    """Test POST /api/v1/liveness with a real face image file upload."""
    _, img_bytes = cv2.imencode(".jpg", real_face_image)

    response = client.post(
        "/api/v1/liveness",
        files={"file": ("test.jpg", img_bytes.tobytes(), "image/jpeg")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["face_detected"] is True
    assert "liveness" in data
    assert data["liveness"]["status"] in ["live", "spoof_detected", "inconclusive"]
    assert "MiniFASNetV2" in data["liveness"]["individual_scores"]
    assert "MiniFASNetV1SE" in data["liveness"]["individual_scores"]
    assert data["liveness"]["processing_time_ms"] >= 0.0


def test_api_liveness_base64_endpoint(client: TestClient, real_face_image):
    """Test POST /api/v1/liveness/base64 with a base64 encoded real face image."""
    _, img_bytes = cv2.imencode(".jpg", real_face_image)
    b64_str = base64.b64encode(img_bytes.tobytes()).decode("utf-8")

    response = client.post(
        "/api/v1/liveness/base64",
        json={"image_base64": f"data:image/jpeg;base64,{b64_str}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["face_detected"] is True
    assert "liveness" in data
    assert data["liveness"]["status"] in ["live", "spoof_detected", "inconclusive"]


def test_api_liveness_endpoint_no_face_detected(client: TestClient, sample_image):
    """Test POST /api/v1/liveness with an image with no face returns face_detected=False."""
    _, img_bytes = cv2.imencode(".jpg", sample_image)

    response = client.post(
        "/api/v1/liveness",
        files={"file": ("noface.jpg", img_bytes.tobytes(), "image/jpeg")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert data["face_detected"] is False
    assert "guidance" in data


# =========================================================================
# 7. Unified Analysis Pipeline & Fail-Closed Security Tests
# =========================================================================

def test_api_analyze_includes_liveness_telemetry(client: TestClient):
    """Test POST /api/v1/analyze includes anti-spoofing telemetry."""
    test_image_path = os.path.join(os.path.dirname(__file__), "..", "test.jpg")
    if not os.path.exists(test_image_path):
        pytest.skip("Test image test.jpg not available for full pipeline test.")

    with open(test_image_path, "rb") as f:
        response = client.post(
            "/api/v1/analyze",
            files={"file": ("test.jpg", f.read(), "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    if data["face_detected"]:
        assert "liveness" in data
        assert "antispoof_time_ms" in data


def test_api_embedding_response_schema_compatibility(client: TestClient):
    """Test POST /api/v1/embedding returns valid FaceEmbeddingResponse with liveness details."""
    single_face_path = os.path.join(os.path.dirname(__file__), "single_face.jpg")
    if not os.path.exists(single_face_path):
        pytest.skip("single_face.jpg not found for embedding enrollment test.")

    with open(single_face_path, "rb") as f:
        response = client.post(
            "/api/v1/embedding",
            files={"file": ("single_face.jpg", f.read(), "image/jpeg")},
        )

    # May return 200 if genuine or 400 if spoof/quality check triggers
    if response.status_code == 200:
        data = response.json()
        assert data["success"] is True
        assert len(data["embedding"]) == 512
        assert "liveness" in data
    else:
        assert response.status_code in [400, 500]
        data = response.json()
        assert "detail" in data
