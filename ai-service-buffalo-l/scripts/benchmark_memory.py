import os
import psutil
import time
import cv2
from insightface.app import FaceAnalysis


def run_memory_benchmark() -> None:
    process = psutil.Process(os.getpid())

    def memory_mb() -> float:
        return process.memory_info().rss / 1024 / 1024

    print("=" * 60)
    print("IntelliGuard Buffalo_L Memory & Performance Benchmark")
    print("=" * 60)
    print(f"Base Python Memory: {memory_mb():.2f} MB")

    t0 = time.perf_counter()
    app = FaceAnalysis(name="buffalo_l", allowed_modules=["detection", "recognition"])
    app.prepare(ctx_id=-1, det_size=(640, 640))
    t_load = (time.perf_counter() - t0) * 1000

    print(f"After loading Buffalo_L: {memory_mb():.2f} MB (Load time: {t_load:.1f} ms)")

    image_path = "test.jpg" if os.path.exists("test.jpg") else "../ai-service/test.jpg"
    image = cv2.imread(image_path)

    if image is None:
        print(f"Warning: Could not read {image_path} for inference benchmark.")
        return

    print(f"After loading image ({image.shape[1]}x{image.shape[0]}): {memory_mb():.2f} MB")

    # Warmup
    _ = app.get(image)

    # Benchmark inference
    times = []
    for _ in range(5):
        t_start = time.perf_counter()
        faces = app.get(image)
        times.append((time.perf_counter() - t_start) * 1000)

    avg_time = sum(times) / len(times)
    min_time = min(times)

    print(f"Inference Memory: {memory_mb():.2f} MB")
    print(f"Faces detected: {len(faces)}")
    print(f"Inference latency: avg={avg_time:.2f} ms, min={min_time:.2f} ms (over 5 runs)")

    for i, face in enumerate(faces):
        print(f"  • Face {i + 1}: det_score={face.det_score:.4f}, embedding_dim={len(face.embedding)}, bbox={face.bbox.astype(int).tolist()}")

    print("=" * 60)


if __name__ == "__main__":
    run_memory_benchmark()
