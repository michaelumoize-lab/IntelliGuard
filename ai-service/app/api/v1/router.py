from fastapi import APIRouter
from app.api.v1.endpoints import health, detect, embedding

api_router = APIRouter()

# Include health check endpoints
api_router.include_router(health.router, tags=["Health"])

# Include face detection endpoints
api_router.include_router(detect.router, tags=["Face Detection"])

# Include face embedding endpoints
api_router.include_router(embedding.router, tags=["Face Embedding"])


