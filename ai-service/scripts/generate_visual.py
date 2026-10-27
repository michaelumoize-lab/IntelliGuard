import os
import sys
import argparse
import cv2
import numpy as np
from insightface.app import FaceAnalysis


def main():
    parser = argparse.ArgumentParser(description="Generate side-by-side comparison visualization between Buffalo_S and Buffalo_L")
    parser.add_argument("--image", default=None, help="Path to input test image")
    parser.add_argument("--output", default="comparison_visual.jpg", help="Path to output annotated image")
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

    h, w = img.shape[:2]

    # Load models
    print("[1/2] Running Buffalo_S...")
    app_s = FaceAnalysis(name="buffalo_s", allowed_modules=["detection", "recognition"])
    app_s.prepare(ctx_id=-1, det_size=(320, 320))

    print("[2/2] Running Buffalo_L...")
    app_l = FaceAnalysis(name="buffalo_l", allowed_modules=["detection", "recognition"])
    app_l.prepare(ctx_id=-1, det_size=(640, 640))

    faces_s = app_s.get(img)
    faces_l = app_l.get(img)

    canvas_s = img.copy()
    canvas_l = img.copy()

    # Annotate Buffalo_S
    for i, f in enumerate(faces_s):
        box = f.bbox.astype(int)
        conf = float(f.det_score)
        cv2.rectangle(canvas_s, (box[0], box[1]), (box[2], box[3]), (0, 255, 0), 3)
        cv2.putText(
            canvas_s,
            f"Buffalo_S Face {i+1}: {conf:.3f}",
            (box[0], max(30, box[1] - 12)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 0),
            2,
        )
        if hasattr(f, "kps") and f.kps is not None:
            for kp in f.kps:
                cv2.circle(canvas_s, (int(kp[0]), int(kp[1])), 5, (0, 0, 255), -1)

    # Annotate Buffalo_L
    for i, f in enumerate(faces_l):
        box = f.bbox.astype(int)
        conf = float(f.det_score)
        color = (255, 120, 0) if i == 0 else (0, 0, 255)
        cv2.rectangle(canvas_l, (box[0], box[1]), (box[2], box[3]), color, 3)
        label = f"Buffalo_L Primary: {conf:.3f}" if i == 0 else f"Bg Face {i}: {conf:.3f}"
        cv2.putText(
            canvas_l,
            label,
            (box[0], max(25, box[1] - 10)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            color,
            2,
        )
        if hasattr(f, "kps") and f.kps is not None:
            for kp in f.kps:
                cv2.circle(canvas_l, (int(kp[0]), int(kp[1])), 5, (0, 255, 255), -1)

    # Add title banners
    s_conf = f"{faces_s[0].det_score:.3f}" if len(faces_s) > 0 else "N/A"
    s_label = f"Buffalo_S: {len(faces_s)} Face(s) | Conf: {s_conf}"
    cv2.rectangle(canvas_s, (0, 0), (w, 50), (0, 0, 0), -1)
    cv2.putText(canvas_s, s_label, (15, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)

    l_conf = f"{faces_l[0].det_score:.3f}" if len(faces_l) > 0 else "N/A"
    l_label = f"Buffalo_L: {len(faces_l)} Face(s) | Conf: {l_conf}"
    cv2.rectangle(canvas_l, (0, 0), (w, 50), (0, 0, 0), -1)
    cv2.putText(canvas_l, l_label, (15, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 180, 50), 2)

    # Stack side-by-side
    combined = np.hstack([canvas_s, canvas_l])
    output_path = args.output
    cv2.imwrite(output_path, combined)
    print(f"Visual comparison successfully saved to: {output_path}")


if __name__ == "__main__":
    main()
