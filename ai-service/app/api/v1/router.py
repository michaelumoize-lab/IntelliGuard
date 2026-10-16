from fastapi import APIRouter
from app.api.v1.endpoints import health, detect, embedding, analyze

api_router = APIRouter()

# Include health check endpoints
api_router.include_router(health.router, tags=["Health"])

# Include unified computer vision analysis endpoint (YOLO + InsightFace)
api_router.include_router(analyze.router, tags=["Unified Analysis"])

# Include face detection endpoints
api_router.include_router(detect.router, tags=["Face Detection"])

# Include face embedding endpoints
api_router.include_router(embedding.router, tags=["Face Embedding"])


