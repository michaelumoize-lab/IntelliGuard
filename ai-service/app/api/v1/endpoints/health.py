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
    
    if manager is not None and manager.is_loaded:
        return HealthResponse(
            status="healthy",
            service="intelliguard-ai",
            model=manager.model_name,
            model_loaded=True,
            execution_provider=manager.active_provider,
            error=None,
        )
    
    # Degraded status if model failed to load during startup
    response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    error_msg = manager.error_message if manager else "Model manager not initialized"
    return HealthResponse(
        status="degraded",
        service="intelliguard-ai",
        model=settings.INSIGHTFACE_MODEL,
        model_loaded=False,
        execution_provider="Unavailable",
        error=error_msg,
    )
