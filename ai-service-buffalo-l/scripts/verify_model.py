import sys
import os
import onnxruntime as ort
from insightface.app import FaceAnalysis

def verify_buffalo_l() -> None:
    print("=" * 60)
    print("IntelliGuard: Verifying InsightFace Buffalo_L Model")
    print("=" * 60)
    
    available_providers = ort.get_available_providers()
    print(f"Available ONNX providers: {available_providers}")
    
    ctx_id = 0 if "CUDAExecutionProvider" in available_providers else -1
    providers = ["CUDAExecutionProvider", "CPUExecutionProvider"] if ctx_id == 0 else ["CPUExecutionProvider"]
    
    print(f"Initializing FaceAnalysis(name='buffalo_l')...")
    app = FaceAnalysis(name="buffalo_l", allowed_modules=["detection", "recognition"], providers=providers)
    app.prepare(ctx_id=ctx_id, det_size=(640, 640))
    
    print("\nModels successfully loaded in FaceAnalysis:")
    for mod_name, mod in app.models.items():
        sess = getattr(mod, "session", None)
        active_provider = sess.get_providers()[0] if sess else "Unknown"
        print(f"  • Module '{mod_name}': active provider = {active_provider}")
    
    print("\n[SUCCESS] Buffalo_L (SCRFD-10G + ResNet-50 ArcFace) is verified and ready!")
    print("=" * 60)

if __name__ == "__main__":
    verify_buffalo_l()
