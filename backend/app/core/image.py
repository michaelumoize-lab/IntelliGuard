import base64
import logging
import numpy as np
import cv2
from fastapi import HTTPException, status

logger = logging.getLogger("intelliguard.image")


def read_image_bytes_to_cv2(image_bytes: bytes) -> np.ndarray:
    """Decode raw bytes into a OpenCV BGR numpy array.
    
    Raises HTTPException 400 if decoding fails or byte array is invalid.
    """
    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty image data provided.",
        )

    try:
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None or img.size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to decode image. Format may be unsupported or file corrupted.",
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
