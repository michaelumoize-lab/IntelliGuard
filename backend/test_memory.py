import os
import psutil
import cv2
from insightface.app import FaceAnalysis

process = psutil.Process(os.getpid())


def memory_mb():
    return process.memory_info().rss / 1024 / 1024


print(f"Before InsightFace: {memory_mb():.2f} MB")

app = FaceAnalysis(name="buffalo_l")
app.prepare(ctx_id=-1, det_size=(640, 640))

print(f"After model loading: {memory_mb():.2f} MB")

image = cv2.imread("test.jpg")

print(f"After loading image: {memory_mb():.2f} MB")

faces = app.get(image)

print(f"After inference: {memory_mb():.2f} MB")
print(f"Faces detected: {len(faces)}")

for i, face in enumerate(faces):
    print(f"Face {i + 1} embedding size: {len(face.embedding)}")

print(f"Final memory: {memory_mb():.2f} MB")