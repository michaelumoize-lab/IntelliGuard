import uvicorn
from app.core.config import settings

if __name__ == "__main__":
    is_development = settings.ENVIRONMENT.strip().lower() != "production"
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=is_development,
    )
