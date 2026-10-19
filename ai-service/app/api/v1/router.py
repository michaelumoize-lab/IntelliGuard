import hmac
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from app.api.v1.endpoints import health, detect, embedding, analyze
from app.core.config import settings


async def verify_service_key(
    x_service_key: Optional[str] = Header(default=None, alias="X-Service-Key"),
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
) -> None:
    """Verify the shared service-key header using constant-time comparison when configured."""
    expected_key = (settings.AI_SERVICE_API_KEY or "").strip()
    if not expected_key:
        return

    provided_key = (x_service_key or x_api_key or "").strip()
    if not provided_key or not hmac.compare_digest(
        provided_key.encode("utf-8"), expected_key.encode("utf-8")
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing service API key.",
        )


api_router = APIRouter()

# Include health check endpoints (exempt from service-key authentication)
api_router.include_router(health.router, tags=["Health"])

# Include protected v1 inference endpoints
api_router.include_router(
    analyze.router,
    tags=["Unified Analysis"],
    dependencies=[Depends(verify_service_key)],
)
api_router.include_router(
    detect.router,
    tags=["Face Detection"],
    dependencies=[Depends(verify_service_key)],
)
api_router.include_router(
    embedding.router,
    tags=["Face Embedding"],
    dependencies=[Depends(verify_service_key)],
)
