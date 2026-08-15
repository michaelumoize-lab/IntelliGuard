from insightface.app import FaceAnalysis

app = FaceAnalysis(name="buffalo_s", allowed_modules=['detection', 'recognition'])
app.prepare(ctx_id=0, det_size=(320, 320))

print("Buffalo_S loaded successfully!")