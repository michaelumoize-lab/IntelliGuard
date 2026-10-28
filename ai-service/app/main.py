import asyncio
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


async def _watch_env_changes(app: FastAPI) -> None:
    """Watches the .env file for changes to INSIGHTFACE_MODEL and hot-reloads the active model without restarting."""
    import os
    import asyncio
    from app.core.config import settings

    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if not os.path.exists(env_path):
        env_path = ".env"

    last_mtime = os.path.getmtime(env_path) if os.path.exists(env_path) else 0.0

    while True:
        try:
            await asyncio.sleep(1.5)
            if not os.path.exists(env_path):
                continue

            current_mtime = os.path.getmtime(env_path)
            if current_mtime > last_mtime:
                last_mtime = current_mtime
                settings.reload()

                manager = getattr(app.state, "insightface_manager", None)
                if manager is not None:
                    current_model = manager.model_name
                    target_model = settings.INSIGHTFACE_MODEL

                    if current_model != target_model:
                        logger.info(
                            f"🔄 Live .env change detected: Switching InsightFace model from '{current_model}' to '{target_model}'..."
                        )
                        det_size = settings.INSIGHTFACE_DET_SIZE
                        app.state.insightface_app = None
                        try:
                            success = await asyncio.to_thread(
                                manager.reload,
                                new_model_name=target_model,
                                det_size=det_size,
                            )
                        finally:
                            app.state.insightface_app = manager.app

                        if success:
                            logger.info(
                                f"✅ InsightFace live hot-reload complete: Active model is now '{manager.model_name}' (det_size={det_size})."
                            )
                        else:
                            logger.error(
                                f"❌ Failed to live-reload InsightFace model '{target_model}'. Active model remains '{manager.model_name}'."
                            )
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning(f"Notice from .env file watcher: {e}")


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

    # Start live .env watcher task to support instant hot-reloading when INSIGHTFACE_MODEL changes
    watcher_task = asyncio.create_task(_watch_env_changes(app))

    yield  # Serve requests

    logger.info("Shutting down IntelliGuard AI Service...")
    watcher_task.cancel()
    try:
        await watcher_task
    except asyncio.CancelledError:
        pass


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
