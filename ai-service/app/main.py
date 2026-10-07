import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.insightface import insightface_manager
from app.api.v1.router import api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("intelliguard.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """FastAPI lifespan event handler for startup and shutdown actions."""
    logger.info("Initializing IntelliGuard AI Service...")

    # Load InsightFace model into memory on startup
    success = insightface_manager.initialize()
    if success:
        logger.info("InsightFace model initialization completed successfully.")
    else:
        logger.error(
            f"InsightFace model initialization failed: {insightface_manager.error_message}. Service starting in degraded mode."
        )

    # Attach model manager and app instance to FastAPI application state
    app.state.insightface_manager = insightface_manager
    app.state.insightface_app = insightface_manager.app

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
