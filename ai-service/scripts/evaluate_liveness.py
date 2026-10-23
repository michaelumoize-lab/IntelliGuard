#!/usr/bin/env python3
"""IntelliGuard Face Anti-Spoofing & Presentation Attack Detection (PAD) Evaluation Utility

Evaluates MiniFASNetV2, MiniFASNetV1SE, and the Dual Ensemble against genuine and presentation attack samples.
Computes ISO/IEC 30107-3 compliant biometric performance metrics:
- APCER (Attack Presentation Classification Error Rate - False Acceptance of Spoofs)
- BPCER (Bona Fide Presentation Classification Error Rate - False Rejection of Genuine Faces)
- ACER (Average Classification Error Rate = (APCER + BPCER) / 2)
- Inference latency percentiles (Mean, Median, P95, Min, Max)
"""

import os
import sys
import time
import argparse
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import cv2
import numpy as np

# Ensure ai-service root is in sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
SERVICE_ROOT = SCRIPT_DIR.parent
if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

from app.core.config import settings
from app.core.anti_spoofing import AntiSpoofManager, AntiSpoofResult

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("evaluate_liveness")


def evaluate_dataset(
    manager: AntiSpoofManager,
    genuine_dir: Optional[Path],
    spoof_dir: Optional[Path],
    face_app=None,
) -> Dict[str, any]:
    """Run evaluation across genuine and spoof sample directories."""
    results = {
        "genuine": [],
        "spoof": [],
        "latencies": [],
    }

    # 1. Evaluate Genuine Samples (Bona Fide)
    if genuine_dir and genuine_dir.exists():
        genuine_files = [f for f in genuine_dir.iterdir() if f.suffix.lower() in [".jpg", ".jpeg", ".png", ".webp"]]
        logger.info(f"Evaluating {len(genuine_files)} genuine (bona fide) samples from {genuine_dir}...")
        for img_path in genuine_files:
            img = cv2.imread(str(img_path))
            if img is None:
                continue

            # Detect face or use center crop
            bbox = None
            if face_app is not None:
                faces = face_app.get(img)
                if faces:
                    bbox = faces[0].bbox.tolist()
            if bbox is None:
                h, w = img.shape[:2]
                bbox = [w * 0.2, h * 0.2, w * 0.8, h * 0.8]

            t0 = time.perf_counter()
            res = manager.predict(img, bbox)
            t_ms = (time.perf_counter() - t0) * 1000
            results["latencies"].append(t_ms)
            results["genuine"].append({
                "file": img_path.name,
                "live_score": res.live_score,
                "status": res.status,
                "individual_scores": res.individual_scores,
                "latency_ms": res.processing_time_ms,
            })

    # 2. Evaluate Presentation Attack Samples (Spoof)
    if spoof_dir and spoof_dir.exists():
        spoof_files = [f for f in spoof_dir.iterdir() if f.suffix.lower() in [".jpg", ".jpeg", ".png", ".webp"]]
        logger.info(f"Evaluating {len(spoof_files)} presentation attack samples from {spoof_dir}...")
        for img_path in spoof_files:
            img = cv2.imread(str(img_path))
            if img is None:
                continue

            bbox = None
            if face_app is not None:
                faces = face_app.get(img)
                if faces:
                    bbox = faces[0].bbox.tolist()
            if bbox is None:
                h, w = img.shape[:2]
                bbox = [w * 0.2, h * 0.2, w * 0.8, h * 0.8]

            t0 = time.perf_counter()
            res = manager.predict(img, bbox)
            t_ms = (time.perf_counter() - t0) * 1000
            results["latencies"].append(t_ms)
            results["spoof"].append({
                "file": img_path.name,
                "live_score": res.live_score,
                "status": res.status,
                "individual_scores": res.individual_scores,
                "latency_ms": res.processing_time_ms,
            })

    # 3. Compute ISO/IEC 30107-3 Metrics
    num_genuine = len(results["genuine"])
    num_spoof = len(results["spoof"])

    # BPCER: Genuine faces classified as spoof or inconclusive (false rejection)
    false_rejections = sum(1 for r in results["genuine"] if r["status"] != "live")
    bpcer = (false_rejections / num_genuine * 100) if num_genuine > 0 else 0.0

    # APCER: Presentation attacks classified as live (false acceptance)
    false_acceptances = sum(1 for r in results["spoof"] if r["status"] == "live")
    apcer = (false_acceptances / num_spoof * 100) if num_spoof > 0 else 0.0

    # ACER: Average Classification Error Rate
    acer = (apcer + bpcer) / 2.0

    # Latency statistics
    lats = results["latencies"] or [0.0]
    lat_stats = {
        "mean_ms": round(float(np.mean(lats)), 2),
        "median_ms": round(float(np.median(lats)), 2),
        "p95_ms": round(float(np.percentile(lats, 95)), 2),
        "min_ms": round(float(np.min(lats)), 2),
        "max_ms": round(float(np.max(lats)), 2),
    }

    return {
        "num_genuine": num_genuine,
        "num_spoof": num_spoof,
        "false_rejections": false_rejections,
        "false_acceptances": false_acceptances,
        "BPCER_pct": round(bpcer, 2),
        "APCER_pct": round(apcer, 2),
        "ACER_pct": round(acer, 2),
        "latency": lat_stats,
        "results": results,
    }


def main():
    parser = argparse.ArgumentParser(description="IntelliGuard Anti-Spoofing Benchmark & PAD Evaluator")
    parser.add_argument("--genuine-dir", type=str, default="", help="Path to directory containing genuine/bona fide faces")
    parser.add_argument("--spoof-dir", type=str, default="", help="Path to directory containing spoof / attack faces")
    parser.add_argument("--test-image", type=str, default="", help="Single image to test directly")
    args = parser.parse_args()

    print("\n" + "=" * 65)
    print("   IntelliGuard Face Anti-Spoofing / PAD Evaluation")
    print("   Dual Ensemble: MiniFASNetV2 (2.7x) + MiniFASNetV1SE (4.0x)")
    print("=" * 65 + "\n")

    manager = AntiSpoofManager()
    manager.load_models()

    if not manager.is_loaded:
        logger.error("Failed to load Anti-Spoofing models!")
        sys.exit(1)

    # If single test image is specified
    target_img_path = args.test_image
    if not target_img_path and not args.genuine_dir and not args.spoof_dir:
        # Check if michael.JPG exists in project root or current dir
        candidates = [
            SERVICE_ROOT / "michael.JPG",
            SERVICE_ROOT.parent / "ai-service-buffalo-l" / "michael.JPG",
            SERVICE_ROOT / "test.jpg",
        ]
        for c in candidates:
            if c.exists():
                target_img_path = str(c)
                break

    if target_img_path:
        p = Path(target_img_path)
        if not p.exists():
            logger.error(f"Test image not found: {p}")
            sys.exit(1)

        img = cv2.imread(str(p))
        if img is None:
            logger.error(f"Failed to read image: {p}")
            sys.exit(1)

        h, w = img.shape[:2]
        # Full-face detection center crop as fallback
        bbox = [w * 0.1, h * 0.1, w * 0.9, h * 0.9]

        print(f"Testing image: {p.name} ({w}x{h})")
        res = manager.predict(img, bbox)

        print("-" * 65)
        print(f"Verdict:            {res.status.upper()}")
        print(f"Bona Fide Score:    {res.live_score:.4f} ({res.live_score * 100:.2f}%)")
        print(f"Operational Range:  Live >= {manager.live_threshold:.2f} | Spoof <= {manager.spoof_threshold:.2f}")
        print(f"MiniFASNetV2 (2.7): {res.individual_scores.get('MiniFASNetV2', 0.0):.4f}")
        print(f"MiniFASNetV1SE(4.0):{res.individual_scores.get('MiniFASNetV1SE', 0.0):.4f}")
        print(f"Ensemble Fusion:    {res.ensemble_method}")
        print(f"Inference Latency:  {res.processing_time_ms:.2f} ms")
        print("-" * 65)

    if args.genuine_dir or args.spoof_dir:
        gen_dir = Path(args.genuine_dir) if args.genuine_dir else None
        spf_dir = Path(args.spoof_dir) if args.spoof_dir else None
        metrics = evaluate_dataset(manager, gen_dir, spf_dir)

        print("\n" + "=" * 65)
        print("   ISO/IEC 30107-3 Biometric PAD Performance Report")
        print("=" * 65)
        print(f"Genuine Samples:      {metrics['num_genuine']}")
        print(f"Presentation Attacks: {metrics['num_spoof']}")
        print(f"BPCER (False Reject): {metrics['BPCER_pct']}% ({metrics['false_rejections']}/{metrics['num_genuine']})")
        print(f"APCER (False Accept): {metrics['APCER_pct']}% ({metrics['false_acceptances']}/{metrics['num_spoof']})")
        print(f"ACER (Avg Error):     {metrics['ACER_pct']}%")
        print("-" * 65)
        print(f"Mean Latency:         {metrics['latency']['mean_ms']} ms")
        print(f"Median Latency:       {metrics['latency']['median_ms']} ms")
        print(f"P95 Latency:          {metrics['latency']['p95_ms']} ms")
        print(f"Min / Max:            {metrics['latency']['min_ms']} ms / {metrics['latency']['max_ms']} ms")
        print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
