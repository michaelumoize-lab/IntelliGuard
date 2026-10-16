from fastapi import APIRouter, Request, status
from app.schemas.health import HealthResponse
from app.core.config import settings

router = APIRouter()


from fastapi import APIRouter, Request, Response, status

@router.get("/health", response_model=HealthResponse, status_code=status.HTTP_200_OK)
async def get_health_status(request: Request, response: Response) -> HealthResponse:
    """Retrieve service health status, model loading state, and active ONNX execution provider.
    
    This endpoint reads the pre-initialized model state from application memory
    and does NOT reload or re-initialize the model upon invocation.
    """
    # Prefer application state set during lifespan, fallback to manager instance
    manager = getattr(request.app.state, "insightface_manager", None)
    yolo = getattr(request.app.state, "yolo_detector", None)
    
    insightface_ready = manager is not None and manager.is_loaded
    yolo_ready = yolo is not None and yolo.is_loaded

    if insightface_ready and yolo_ready:
        return HealthResponse(
            status="healthy",
            service="intelliguard-ai",
            model=manager.model_name,
            model_loaded=True,
            yolo_loaded=True,
            yolo_model=yolo.model_name if yolo else settings.YOLO_MODEL_NAME,
            execution_provider=manager.active_provider,
            error=None,
        )
    
    # Degraded status if either model failed to load during startup
    response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    errors = []
    if not insightface_ready:
        errors.append(manager.error_message if manager else "InsightFace manager not initialized")
    if not yolo_ready:
        errors.append(yolo.error_message if yolo else "YOLO detector not initialized")
    error_msg = "; ".join(errors)

    return HealthResponse(
        status="degraded",
        service="intelliguard-ai",
        model=settings.INSIGHTFACE_MODEL,
        model_loaded=insightface_ready,
        yolo_loaded=yolo_ready,
        yolo_model=settings.YOLO_MODEL_NAME,
        execution_provider=manager.active_provider if manager else "Unavailable",
        error=error_msg,
    )
