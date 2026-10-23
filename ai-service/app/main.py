import logging
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings
from app.core.insightface import insightface_manager
from app.core.yolo import yolo_detector
from app.core.anti_spoofing import antispoof_manager
from app.api.v1.router import api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("intelliguard.main")


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Propagates or generates X-Correlation-ID header for distributed request tracing."""

    async def dispatch(self, request: Request, call_next):
        correlation_id = (
            request.headers.get("X-Correlation-ID")
            or request.headers.get("X-Request-ID")
            or str(uuid.uuid4())
        )
        request.state.correlation_id = correlation_id
        response: Response = await call_next(request)
        response.headers["X-Correlation-ID"] = correlation_id
        return response


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """FastAPI lifespan event handler for startup and shutdown actions."""
    logger.info("Initializing IntelliGuard AI Service...")

    # 1. Load InsightFace model into memory on startup
    insightface_ok = insightface_manager.initialize()
    if insightface_ok:
        logger.info("InsightFace model initialization completed successfully.")
    else:
        logger.error(
            f"InsightFace model initialization failed: {insightface_manager.error_message}. Service starting in degraded mode."
        )

    # 2. Load YOLO person detector into memory on startup
    yolo_ok = yolo_detector.initialize()
    if yolo_ok:
        logger.info("YOLO Person Detector initialization completed successfully.")
    else:
        logger.error(
            f"YOLO detector initialization failed: {yolo_detector.error_message}. Service starting in degraded mode."
        )

    # 3. Load Anti-Spoofing dual-model ensemble (MiniFASNetV2 + MiniFASNetV1SE)
    if settings.ANTISPOOF_ENABLED:
        antispoof_ok = antispoof_manager.initialize()
        if antispoof_ok:
            logger.info("Anti-Spoofing dual-model (MiniFASNetV2 + MiniFASNetV1SE) initialization completed successfully.")
        else:
            logger.error(
                f"Anti-Spoofing initialization failed: {antispoof_manager.error_message}. Service starting with liveness degraded."
            )
    else:
        logger.info("Anti-Spoofing is disabled via ANTISPOOF_ENABLED=False.")

    # Attach model managers and app instances to FastAPI application state
    app.state.insightface_manager = insightface_manager
    app.state.insightface_app = insightface_manager.app
    app.state.yolo_detector = yolo_detector
    app.state.antispoof_manager = antispoof_manager

    yield  # Serve requests

    logger.info("Shutting down IntelliGuard AI Service...")


# Instantiate FastAPI application
app = FastAPI(
    title="IntelliGuard AI Service",
    description="Computer vision and facial recognition inference service for IntelliGuard.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS Middleware for Next.js frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Distributed correlation tracing middleware
app.add_middleware(CorrelationIdMiddleware)

# Include API v1 router under /api/v1 prefix
app.include_router(api_router, prefix="/api/v1")


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint for quick service check."""
    return {
        "service": "IntelliGuard AI",
        "status": "running",
        "version": "1.0.0",
    }
