import numpy as np
import pytest
from app.core.liveness import (
    preprocess_face_crop,
    LivenessDetector,
    LivenessResult,
)


def test_preprocess_face_crop_shape_and_range():
    """Verify preprocessing outputs exact (1, 3, 128, 128) RGB float32 in [0, 1]."""
    img = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
    face_bbox = [100.0, 80.0, 240.0, 260.0]

    tensor = preprocess_face_crop(img, face_bbox, target_size=128, expansion_factor=1.25)

    assert tensor.shape == (1, 3, 128, 128)
    assert tensor.dtype == np.float32
    assert tensor.min() >= 0.0
    assert tensor.max() <= 1.0


def test_preprocess_face_crop_boundary_clamping():
    """Verify face bbox near image edges clamps safely without crashing."""
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    # Face bounding box touching borders
    face_bbox = [0.0, 0.0, 95.0, 95.0]

    tensor = preprocess_face_crop(img, face_bbox, target_size=128, expansion_factor=1.5)
    assert tensor.shape == (1, 3, 128, 128)
    assert tensor.dtype == np.float32


def test_liveness_decision_real_face():
    """Verify real face logits result in status='live' and is_live=True."""
    detector = LivenessDetector()
    detector.is_initialized = True

    class MockSessionReal:
        def run(self, output_names, input_feed):
            # [real_logit, spoof_logit] -> real is much higher
            return [np.array([[5.0, -5.0]], dtype=np.float32)]

    detector.session = MockSessionReal()
    detector.input_name = "input"

    img = np.zeros((200, 200, 3), dtype=np.uint8)
    res = detector.predict(img, [20, 20, 100, 100], threshold=0.60)

    assert res.is_live is True
    assert res.status == "live"
    assert res.score > 0.99
    assert res.error_message is None


def test_liveness_decision_spoof_presentation_attack():
    """Verify spoof logits result in status='spoof' and is_live=False."""
    detector = LivenessDetector()
    detector.is_initialized = True

    class MockSessionSpoof:
        def run(self, output_names, input_feed):
            # [real_logit, spoof_logit] -> spoof is much higher
            return [np.array([[-4.0, 4.0]], dtype=np.float32)]

    detector.session = MockSessionSpoof()
    detector.input_name = "input"

    img = np.zeros((200, 200, 3), dtype=np.uint8)
    res = detector.predict(img, [20, 20, 100, 100], threshold=0.60)

    assert res.is_live is False
    assert res.status == "spoof"
    assert res.score < 0.01
    assert res.error_message is None


def test_liveness_threshold_boundary():
    """Verify threshold boundary behavior."""
    detector = LivenessDetector()
    detector.is_initialized = True

    # Equal logits -> 50% real probability
    class MockSessionEqual:
        def run(self, output_names, input_feed):
            return [np.array([[0.0, 0.0]], dtype=np.float32)]

    detector.session = MockSessionEqual()
    detector.input_name = "input"

    img = np.zeros((200, 200, 3), dtype=np.uint8)
    # With threshold 0.60, 0.50 score should be rejected as spoof
    res_strict = detector.predict(img, [20, 20, 100, 100], threshold=0.60)
    assert res_strict.is_live is False
    assert res_strict.status == "spoof"
    assert round(res_strict.score, 2) == 0.50

    # With threshold 0.40, 0.50 score should pass
    res_lenient = detector.predict(img, [20, 20, 100, 100], threshold=0.40)
    assert res_lenient.is_live is True
    assert res_lenient.status == "live"


def test_liveness_uninitialized_fails_closed():
    """Verify that uninitialized detector fails closed with status='inconclusive'."""
    detector = LivenessDetector()
    detector.is_initialized = False

    img = np.zeros((200, 200, 3), dtype=np.uint8)
    res = detector.predict(img, [20, 20, 100, 100])

    assert res.is_live is False
    assert res.status == "inconclusive"
    assert res.error_message is not None
    # Crucial security rule: Technical error must NOT be labeled as confirmed spoof
    assert res.status != "spoof"


def test_liveness_inference_exception_fails_closed():
    """Verify that an ONNX runtime exception fails closed with status='inconclusive'."""
    detector = LivenessDetector()
    detector.is_initialized = True

    class MockCrashSession:
        def run(self, output_names, input_feed):
            raise RuntimeError("Hardware / ONNX Execution Provider crashed")

    detector.session = MockCrashSession()
    detector.input_name = "input"

    img = np.zeros((200, 200, 3), dtype=np.uint8)
    res = detector.predict(img, [20, 20, 100, 100])

    assert res.is_live is False
    assert res.status == "inconclusive"
    assert "crashed" in str(res.error_message).lower()
