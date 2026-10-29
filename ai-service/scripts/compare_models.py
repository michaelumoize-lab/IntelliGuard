import os
import sys
import time
import psutil
import argparse
import numpy as np
import cv2
from insightface.app import FaceAnalysis


def get_process_memory_mb() -> float:
    return psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024)


def benchmark_model(name: str, det_size: tuple[int, int], img: np.ndarray, runs: int = 5):
    mem_before = get_process_memory_mb()
    t_load_start = time.perf_counter()
    app = FaceAnalysis(name=name, allowed_modules=["detection", "recognition"])
    app.prepare(ctx_id=-1, det_size=det_size)
    load_time_ms = (time.perf_counter() - t_load_start) * 1000
    mem_after_load = get_process_memory_mb()

    # Warmup
    _ = app.get(img)

    # Benchmark runs
    times = []
    faces = None
    for _ in range(runs):
        t0 = time.perf_counter()
        faces = app.get(img)
        times.append((time.perf_counter() - t0) * 1000)

    avg_time = sum(times) / len(times)
    min_time = min(times)
    mem_peak = get_process_memory_mb()

    return {
        "name": name,
        "load_time_ms": load_time_ms,
        "mem_loaded_mb": mem_after_load - mem_before,
        "mem_peak_mb": mem_peak,
        "avg_infer_ms": avg_time,
        "min_infer_ms": min_time,
        "faces_detected": len(faces) if faces else 0,
        "faces": faces,
    }


def main():
    parser = argparse.ArgumentParser(description="IntelliGuard Biometric Model Comparison: Buffalo_S vs Buffalo_L")
    parser.add_argument("--image", default=None, help="Path to input test image")
    parser.add_argument("--runs", type=int, default=5, help="Number of benchmark inference iterations")
    args = parser.parse_args()

    image_path = args.image
    if not image_path:
        default_candidates = [
            os.path.join(os.path.dirname(__file__), "..", "test.jpg"),
            "test.jpg",
        ]
        for candidate in default_candidates:
            if os.path.exists(candidate):
                image_path = candidate
                break

    if not image_path or not os.path.exists(image_path):
        print(f"Error: Target image file not found. Please provide --image path/to/image.jpg")
        sys.exit(1)

    img = cv2.imread(image_path)
    if img is None:
        print(f"Error: Failed to load image at {image_path}")
        sys.exit(1)

    print("\n" + "=" * 70)
    print(f"  INTELLIGUARD AI: BUFFALO_S vs BUFFALO_L ARCHITECTURAL BENCHMARK")
    print(f"  Input: {os.path.basename(image_path)} ({img.shape[1]}x{img.shape[0]} px) | Iterations: {args.runs}")
    print("=" * 70 + "\n")

    print("[1/2] Benchmarking Buffalo_S (SCRFD-500M @ 320x320 + MobileFaceNet 512D)...")
    res_s = benchmark_model("buffalo_s", (320, 320), img, runs=args.runs)

    print("[2/2] Benchmarking Buffalo_L (SCRFD-10G @ 640x640 + ResNet-50 512D)...")
    res_l = benchmark_model("buffalo_l", (640, 640), img, runs=args.runs)

    print("\n" + "-" * 70)
    print(f"{'Performance Metric':<30} | {'Buffalo_S (Edge)':<16} | {'Buffalo_L (Server)':<16}")
    print("-" * 70)
    print(f"{'Model Load Latency':<30} | {res_s['load_time_ms']:<13.1f} ms | {res_l['load_time_ms']:<13.1f} ms")
    print(f"{'RAM Added upon Load':<30} | {res_s['mem_loaded_mb']:<13.1f} MB | {res_l['mem_loaded_mb']:<13.1f} MB")
    print(f"{'Avg Inference Latency':<30} | {res_s['avg_infer_ms']:<13.1f} ms | {res_l['avg_infer_ms']:<13.1f} ms")
    print(f"{'Min Inference Latency':<30} | {res_s['min_infer_ms']:<13.1f} ms | {res_l['min_infer_ms']:<13.1f} ms")
    print(f"{'Detected Faces Count':<30} | {res_s['faces_detected']:<16} | {res_l['faces_detected']:<16}")

    conf_s = f"{res_s['faces'][0].det_score:.4f}" if res_s["faces_detected"] > 0 else "N/A"
    conf_l = f"{res_l['faces'][0].det_score:.4f}" if res_l["faces_detected"] > 0 else "N/A"
    print(f"{'Primary Face Confidence':<30} | {conf_s:<16} | {conf_l:<16}")
    print("-" * 70 + "\n")


if __name__ == "__main__":
    main()
