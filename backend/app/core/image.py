import base64
import logging
import numpy as np
import cv2
from fastapi import HTTPException, status

logger = logging.getLogger("intelliguard.image")


MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB maximum encoded payload size
MAX_IMAGE_DIMENSION = 4096  # 4096px maximum width or height to prevent decompression bombs


def read_image_bytes_to_cv2(image_bytes: bytes) -> np.ndarray:
    """Decode raw bytes into a OpenCV BGR numpy array.
    
    Raises HTTPException 400 if payload size exceeds limit, decoding fails,
    byte array is invalid, or image dimensions exceed max threshold.
    """
    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty image data provided.",
        )

    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Uploaded image payload size ({len(image_bytes)} bytes) exceeds the maximum allowed limit of {MAX_IMAGE_BYTES} bytes.",
        )

    try:
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None or img.size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to decode image. Format may be unsupported or file corrupted.",
            )

        h, w = img.shape[:2]
        if h > MAX_IMAGE_DIMENSION or w > MAX_IMAGE_DIMENSION:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Decoded image dimensions ({w}x{h}) exceed maximum allowed limit of {MAX_IMAGE_DIMENSION}x{MAX_IMAGE_DIMENSION}.",
            )

        return img
    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"Error decoding image bytes: {err}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image content: {str(err)}",
        )


def decode_base64_to_cv2(base64_str: str) -> np.ndarray:
    """Decode a base64 encoded image string into an OpenCV BGR numpy array.
    
    Supports data URI schemes (e.g. data:image/jpeg;base64,...).
    """
    if not base64_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty base64 image string provided.",
        )

    try:
        # Strip data URL prefix if present
        if "," in base64_str:
            base64_str = base64_str.split(",", 1)[1]

        image_bytes = base64.b64decode(base64_str)
        return read_image_bytes_to_cv2(image_bytes)
    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"Error decoding base64 image: {err}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid base64 string: {str(err)}",
        )

