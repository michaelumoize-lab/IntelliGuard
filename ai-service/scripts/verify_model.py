from insightface.app import FaceAnalysis


def verify_model() -> None:
    app = FaceAnalysis(name="buffalo_s", allowed_modules=["detection", "recognition"])
    app.prepare(ctx_id=0, det_size=(320, 320))
    print("Buffalo_S loaded successfully!")


if __name__ == "__main__":
    verify_model()
