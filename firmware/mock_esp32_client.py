"""
IntelliGuard Edge Device Virtual Hardware Mock / Tester
Simulates an ESP32-S3-CAM uploading an image to the Next.js /api/access endpoint.
Tests end-to-end authentication, AI facial inference, pgvector search, and door decision.
"""

import sys
import time
import uuid
import requests
from pathlib import Path

# Target configuration
API_URL = "http://localhost:3000/api/access"
DEVICE_ID = "14"
DEVICE_API_KEY = "ig_dev_76a5b05c6004a4b0853ce3a42fbe9791f084bb6d552e38cc"

# Default real face photo bundled in firmware folder
DEFAULT_SAMPLE_IMAGE = Path(__file__).parent / "sample_face.jpg"

def test_access_upload(image_path: str):
    path = Path(image_path)
    if not path.exists():
        print(f"[!] Error: Image file '{image_path}' not found.")
        return

    print(f"[*] Reading image: {path.resolve()}")
    with open(path, "rb") as f:
        image_bytes = f.read()

    timestamp = str(int(time.time()))
    nonce = f"mock_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}"

    headers = {
        "X-Device-Id": DEVICE_ID,
        "X-Api-Key": DEVICE_API_KEY,
        "X-Timestamp": timestamp,
        "X-Nonce": nonce,
    }

    files = {
        "image": ("capture.jpg", image_bytes, "image/jpeg")
    }

    print(f"[*] Dispatching POST to {API_URL}...")
    print(f"[*] Headers: {headers}")

    start_time = time.time()
    try:
        response = requests.post(API_URL, headers=headers, files=files, timeout=30)
        elapsed_ms = (time.time() - start_time) * 1000
        print(f"[*] Status Code: {response.status_code} ({elapsed_ms:.1f}ms)")
        print(f"[*] Response Payload:\n{response.text}")
    except requests.exceptions.ConnectionError:
        print("[!] Connection Error: Next.js server not running on http://localhost:3000")
    except Exception as e:
        print(f"[!] Request failed: {e}")

if __name__ == "__main__":
    target_image = sys.argv[1] if len(sys.argv) > 1 else str(DEFAULT_SAMPLE_IMAGE)
    print(f"[*] Target Image: {target_image}")
    test_access_upload(target_image)
