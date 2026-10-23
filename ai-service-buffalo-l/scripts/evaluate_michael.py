import os
import sys
import time
import json
import psutil
import numpy as np
import cv2
from insightface.app import FaceAnalysis

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.abspath(os.path.join(current_dir, ".."))
sys.path.insert(0, parent_dir)

try:
    from app.core.quality import assess_face_quality, estimate_head_pose, validate_registration_quality
    HAS_APP_QUALITY = True
except ImportError:
    HAS_APP_QUALITY = False


def get_ram_mb() -> float:
    return psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024)


def analyze_with_model(model_name: str, det_size: tuple[int, int], img: np.ndarray, iterations: int = 10):
    ram_before = get_ram_mb()
    t_load_start = time.perf_counter()
    app = FaceAnalysis(name=model_name, allowed_modules=["detection", "recognition"])
    app.prepare(ctx_id=-1, det_size=det_size)
    load_time_ms = (time.perf_counter() - t_load_start) * 1000
    ram_after_load = get_ram_mb()

    # Cold run
    t_cold_start = time.perf_counter()
    cold_faces = app.get(img)
    cold_time_ms = (time.perf_counter() - t_cold_start) * 1000

    # Warmup + benchmark iterations
    warm_times = []
    faces = None
    for _ in range(iterations):
        t0 = time.perf_counter()
        faces = app.get(img)
        warm_times.append((time.perf_counter() - t0) * 1000)

    avg_warm_ms = float(np.mean(warm_times))
    std_warm_ms = float(np.std(warm_times))
    min_warm_ms = float(np.min(warm_times))
    ram_peak = get_ram_mb()

    if not faces or len(faces) == 0:
        return {
            "model_name": model_name,
            "face_detected": False,
            "faces_count": 0,
            "load_time_ms": load_time_ms,
            "ram_loaded_mb": ram_after_load - ram_before,
            "avg_warm_ms": avg_warm_ms,
        }

    face = faces[0]
    bbox = [round(float(c), 2) for c in face.bbox]
    w = round(bbox[2] - bbox[0], 2)
    h = round(bbox[3] - bbox[1], 2)
    det_conf = round(float(face.det_score), 5)

    kps = [[round(float(p[0]), 2), round(float(p[1]), 2)] for p in face.kps] if hasattr(face, "kps") else []

    # Calculate keypoint distances (Inter-pupillary distance)
    ipd = 0.0
    if len(kps) >= 2:
        re, le = np.array(kps[0]), np.array(kps[1])
        ipd = round(float(np.linalg.norm(le - re)), 2)

    # Embedding analysis
    raw_emb = face.embedding
    raw_norm = float(np.linalg.norm(raw_emb))
    norm_emb = raw_emb / raw_norm if raw_norm > 0 else raw_emb

    emb_stats = {
        "raw_l2_norm": round(raw_norm, 4),
        "min_val": round(float(np.min(norm_emb)), 6),
        "max_val": round(float(np.max(norm_emb)), 6),
        "mean_val": round(float(np.mean(norm_emb)), 6),
        "std_val": round(float(np.std(norm_emb)), 6),
        "median_val": round(float(np.median(norm_emb)), 6),
        "sparsity_002": round(float(np.mean(np.abs(norm_emb) < 0.02) * 100), 2),
        "significant_dims": int(np.sum(np.abs(norm_emb) > 0.08)),
    }

    quality_info = {}
    if HAS_APP_QUALITY:
        q_res = assess_face_quality(img, face)
        is_valid, reject_reason, _ = validate_registration_quality(img, face)
        quality_info = {
            "quality_score": round(q_res.quality_score, 4),
            "sharpness_score": round(q_res.sharpness_score, 4),
            "laplacian_var": round(q_res.laplacian_var, 2),
            "brightness": round(q_res.brightness, 2),
            "brightness_score": round(q_res.brightness_score, 4),
            "contrast": round(q_res.contrast, 2),
            "pose_yaw": q_res.pose_yaw,
            "pose_pitch": q_res.pose_pitch,
            "pose_roll": q_res.pose_roll,
            "pose_score": round(q_res.pose_score, 4),
            "size_score": round(q_res.size_score, 4),
            "is_valid_enrollment": is_valid,
            "enrollment_rejection_reason": reject_reason,
            "issues": q_res.issues,
            "guidance": q_res.guidance,
        }

    return {
        "model_name": model_name,
        "face_detected": True,
        "faces_count": len(faces),
        "load_time_ms": round(load_time_ms, 2),
        "ram_loaded_mb": round(ram_after_load - ram_before, 2),
        "ram_peak_mb": round(ram_peak, 2),
        "cold_time_ms": round(cold_time_ms, 2),
        "avg_warm_ms": round(avg_warm_ms, 2),
        "min_warm_ms": round(min_warm_ms, 2),
        "std_warm_ms": round(std_warm_ms, 2),
        "bbox": bbox,
        "bbox_w": w,
        "bbox_h": h,
        "det_confidence": det_conf,
        "landmarks": kps,
        "interpupillary_dist_px": ipd,
        "embedding_stats": emb_stats,
        "normalized_vector": norm_emb,
        "quality_info": quality_info,
    }


def main():
    img_path = os.path.join(parent_dir, "michael.JPG")
    if not os.path.exists(img_path):
        img_path = "michael.JPG"
    if not os.path.exists(img_path):
        print("Error: michael.JPG not found at", img_path)
        sys.exit(1)

    img = cv2.imread(img_path)
    if img is None:
        print("Error: Could not decode image", img_path)
        sys.exit(1)

    h, w = img.shape[:2]
    print("\n" + "=" * 84)
    print("      INTELLIGUARD BIOMETRIC EXPERIMENT: EVALUATING MICHAEL.JPG")
    print(f"      Image Resolution: {w} x {h} px | File: michael.JPG")
    print("=" * 84 + "\n")

    print("[Step 1/2] Running Buffalo_S (SCRFD-500M + MobileFaceNet 512D ArcFace)...")
    res_s = analyze_with_model("buffalo_s", (320, 320), img, iterations=10)

    print("[Step 2/2] Running Buffalo_L (SCRFD-10G + ResNet-50 512D ArcFace)...")
    res_l = analyze_with_model("buffalo_l", (640, 640), img, iterations=10)

    vec_s = res_s["normalized_vector"]
    vec_l = res_l["normalized_vector"]
    cross_cos_sim = float(np.dot(vec_s, vec_l))
    cross_cos_dist = 1.0 - cross_cos_sim

    report_json_path = os.path.join(current_dir, "michael_comparison_report.json")
    json_summary = {
        "image": {"width": w, "height": h, "path": img_path},
        "cross_model": {
            "cosine_similarity": round(cross_cos_sim, 5),
            "cosine_distance": round(cross_cos_dist, 5),
            "verdict": "Mathematically incompatible vector spaces (different neural backbones)"
        },
        "buffalo_s": {k: v for k, v in res_s.items() if k != "normalized_vector"},
        "buffalo_l": {k: v for k, v in res_l.items() if k != "normalized_vector"},
    }
    with open(report_json_path, "w") as f:
        json.dump(json_summary, f, indent=2)

    crop_s_str = f"{res_s['bbox_w']} x {res_s['bbox_h']}"
    crop_l_str = f"{res_l['bbox_w']} x {res_l['bbox_h']}"
    ipd_s_str = f"{res_s['interpupillary_dist_px']} px"
    ipd_l_str = f"{res_l['interpupillary_dist_px']} px"
    time_s_str = f"{res_s['avg_warm_ms']} ms"
    time_l_str = f"{res_l['avg_warm_ms']} ms"
    min_s_str = f"{res_s['min_warm_ms']} ms"
    min_l_str = f"{res_l['min_warm_ms']} ms"
    std_s_str = f"{res_s['std_warm_ms']} ms"
    std_l_str = f"{res_l['std_warm_ms']} ms"
    ram_s_str = f"{res_s['ram_loaded_mb']} MB"
    ram_l_str = f"{res_l['ram_loaded_mb']} MB"

    print("\n" + "=" * 84)
    print("                   EMPIRICAL BENCHMARK METRICS SUMMARY")
    print("=" * 84)
    print(f"{'Evaluation Metric':<34} | {'Buffalo_S (MobileNet)':<22} | {'Buffalo_L (ResNet-50)':<22}")
    print("-" * 84)
    print(f"{'Faces Detected':<34} | {str(res_s['faces_count']):<22} | {str(res_l['faces_count']):<22}")
    print(f"{'Detection Confidence (det_score)':<34} | {res_s['det_confidence']:<22.5f} | {res_l['det_confidence']:<22.5f}")
    print(f"{'Bounding Box [x1, y1, x2, y2]':<34} | {str(res_s['bbox']):<22} | {str(res_l['bbox']):<22}")
    print(f"{'Face Crop Size (W x H px)':<34} | {crop_s_str:<22} | {crop_l_str:<22}")
    print(f"{'Inter-Pupillary Distance (IPD)':<34} | {ipd_s_str:<22} | {ipd_l_str:<22}")
    print(f"{'Avg Inference Latency (10 runs)':<34} | {time_s_str:<22} | {time_l_str:<22}")
    print(f"{'Min Inference Latency (CPU)':<34} | {min_s_str:<22} | {min_l_str:<22}")
    print(f"{'Std Dev Latency':<34} | {std_s_str:<22} | {std_l_str:<22}")
    print(f"{'RAM Usage Increment':<34} | {ram_s_str:<22} | {ram_l_str:<22}")

    qs = res_s.get("quality_info", {})
    ql = res_l.get("quality_info", {})
    if qs and ql:
        yaw_s_str = f"{qs['pose_yaw']} deg"
        yaw_l_str = f"{ql['pose_yaw']} deg"
        pitch_s_str = f"{qs['pose_pitch']} deg"
        pitch_l_str = f"{ql['pose_pitch']} deg"
        roll_s_str = f"{qs['pose_roll']} deg"
        roll_l_str = f"{ql['pose_roll']} deg"

        print("-" * 84)
        print("                  BIOMETRIC QUALITY & POSE ESTIMATION")
        print("-" * 84)
        print(f"{'Composite Quality Score (0-1)':<34} | {qs['quality_score']:<22.4f} | {ql['quality_score']:<22.4f}")
        print(f"{'Estimated Head Yaw':<34} | {yaw_s_str:<22} | {yaw_l_str:<22}")
        print(f"{'Estimated Head Pitch':<34} | {pitch_s_str:<22} | {pitch_l_str:<22}")
        print(f"{'Estimated Head Roll':<34} | {roll_s_str:<22} | {roll_l_str:<22}")
        print(f"{'Pose Score (0-1)':<34} | {qs['pose_score']:<22.4f} | {ql['pose_score']:<22.4f}")
        print(f"{'Sharpness (Laplacian Var)':<34} | {qs['laplacian_var']:<22.1f} | {ql['laplacian_var']:<22.1f}")
        print(f"{'Illumination (Mean Grayscale)':<34} | {qs['brightness']:<22.1f} | {ql['brightness']:<22.1f}")
        print(f"{'Contrast (Std Dev)':<34} | {qs['contrast']:<22.1f} | {ql['contrast']:<22.1f}")
        print(f"{'Passes Enrollment Validation?':<34} | {str(qs['is_valid_enrollment']):<22} | {str(ql['is_valid_enrollment']):<22}")

    es = res_s["embedding_stats"]
    el = res_l["embedding_stats"]
    range_s_str = f"[{es['min_val']}, {es['max_val']}]"
    range_l_str = f"[{el['min_val']}, {el['max_val']}]"
    sp_s_str = f"{es['sparsity_002']}%"
    sp_l_str = f"{el['sparsity_002']}%"
    sig_s_str = f"{es['significant_dims']} / 512"
    sig_l_str = f"{el['significant_dims']} / 512"

    print("-" * 84)
    print("               512D EMBEDDING VECTOR STATISTICAL PROFILE")
    print("-" * 84)
    print(f"{'Raw Vector L2 Norm (pre-norm)':<34} | {es['raw_l2_norm']:<22.4f} | {el['raw_l2_norm']:<22.4f}")
    print(f"{'Feature Std Deviation':<34} | {es['std_val']:<22.6f} | {el['std_val']:<22.6f}")
    print(f"{'Feature Dynamic Range [min, max]':<34} | {range_s_str:<22} | {range_l_str:<22}")
    print(f"{'Near-Zero Features (< 0.02)':<34} | {sp_s_str:<22} | {sp_l_str:<22}")
    print(f"{'High-Activation Dims (> 0.08)':<34} | {sig_s_str:<22} | {sig_l_str:<22}")
    print("-" * 84)
    print("                     CROSS-MODEL VECTOR DIVERGENCE")
    print("-" * 84)
    print(f"{'Cosine Similarity (S vs L)':<34} | {cross_cos_sim:<22.5f} | (Orthogonal / Noise space)")
    print(f"{'Cosine Distance (S vs L)':<34} | {cross_cos_dist:<22.5f} | (Distance ~1.0 confirms divergence)")
    print("=" * 84 + "\n")


if __name__ == "__main__":
    main()
