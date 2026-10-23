import cv2
import numpy as np
from insightface.app import FaceAnalysis

img_path = "ai-service-buffalo-l/michael.JPG"
img = cv2.imread(img_path)
h, w = img.shape[:2]

# Load models
app_s = FaceAnalysis(name="buffalo_s", allowed_modules=["detection", "recognition"])
app_s.prepare(ctx_id=-1, det_size=(320, 320))

app_l = FaceAnalysis(name="buffalo_l", allowed_modules=["detection", "recognition"])
app_l.prepare(ctx_id=-1, det_size=(640, 640))

faces_s = app_s.get(img)
faces_l = app_l.get(img)

# Create two visualization canvases
canvas_s = img.copy()
canvas_l = img.copy()

# Annotate Buffalo_S
for i, f in enumerate(faces_s):
    box = f.bbox.astype(int)
    conf = f.det_score
    cv2.rectangle(canvas_s, (box[0], box[1]), (box[2], box[3]), (0, 255, 0), 4)
    cv2.putText(canvas_s, f"Buffalo_S Face {i+1}: {conf:.3f}", (box[0], max(30, box[1] - 15)),
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 3)
    if hasattr(f, "kps") and f.kps is not None:
        for kp in f.kps:
            cv2.circle(canvas_s, (int(kp[0]), int(kp[1])), 6, (0, 0, 255), -1)

# Annotate Buffalo_L
for i, f in enumerate(faces_l):
    box = f.bbox.astype(int)
    conf = f.det_score
    color = (255, 120, 0) if i == 0 else (0, 0, 255) # Primary face orange/blue, background faces red
    cv2.rectangle(canvas_l, (box[0], box[1]), (box[2], box[3]), color, 3)
    label = f"Buffalo_L Primary: {conf:.3f}" if i == 0 else f"Bg Face {i}: {conf:.3f}"
    cv2.putText(canvas_l, label, (box[0], max(25, box[1] - 10)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
    if hasattr(f, "kps") and f.kps is not None:
        for kp in f.kps:
            cv2.circle(canvas_l, (int(kp[0]), int(kp[1])), 5, (0, 255, 255), -1)

# Add title banners
s_conf = f"{faces_s[0].det_score:.3f}" if len(faces_s) > 0 else "n/a"
s_label = f"Buffalo_S: {len(faces_s)} {'Face' if len(faces_s) == 1 else 'Faces'} Detected | Conf: {s_conf}"
cv2.rectangle(canvas_s, (0, 0), (w, 60), (0, 0, 0), -1)
cv2.putText(canvas_s, s_label, (20, 42),
            cv2.FONT_HERSHEY_SIMPLEX, 1.1, (0, 255, 0), 3)

l_conf = f"{faces_l[0].det_score:.3f}" if len(faces_l) > 0 else "n/a"
l_label = f"Buffalo_L: {len(faces_l)} {'Face' if len(faces_l) == 1 else 'Faces'} Detected | Primary Conf: {l_conf}"
cv2.rectangle(canvas_l, (0, 0), (w, 60), (0, 0, 0), -1)
cv2.putText(canvas_l, l_label, (20, 42),
            cv2.FONT_HERSHEY_SIMPLEX, 1.1, (255, 180, 50), 3)

# Stack side-by-side
combined = np.hstack([canvas_s, canvas_l])
out_path = "ai-service-buffalo-l/michael_comparison_visual.jpg"
cv2.imwrite(out_path, combined)
print(f"Annotated comparison successfully generated at: {out_path} ({combined.shape[1]}x{combined.shape[0]} px)")
