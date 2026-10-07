import os
from typing import List
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Settings:
    """Application configuration settings."""

    APP_NAME: str = os.getenv("APP_NAME", "IntelliGuard AI")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    INSIGHTFACE_MODEL: str = os.getenv("INSIGHTFACE_MODEL", "buffalo_l")
    
    # Raw CORS string
    _allowed_origins_raw: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
    
    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        if not self._allowed_origins_raw:
            return ["http://localhost:3000"]
        return [origin.strip() for origin in self._allowed_origins_raw.split(",") if origin.strip()]


settings = Settings()
