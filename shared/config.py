import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "ScaleFlow"
    DEV_MODE: str = os.getenv("DEV_MODE", "false").lower()  # "true", "false", or "in_memory"
    
    # Databases & Caches
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "scaleflow")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "scaleflow_pass")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "scaleflow_db")
    
    @property
    def DATABASE_URL(self) -> str:
        if os.getenv("USE_SQLITE", "false").lower() == "true":
            return "sqlite+aiosqlite:///scaleflow.db"
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    
    @property
    def REDIS_URL(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"
        
    # Apache Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    
    # JWT Security
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "scaleflow_super_secret_jwt_key_32_bytes_long_12345")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Microservices Ports / Internal Addresses
    GATEWAY_PORT: int = 8000
    AUTH_SERVICE_URL: str = os.getenv("AUTH_SERVICE_URL", "http://localhost:8001")
    ORDER_SERVICE_URL: str = os.getenv("ORDER_SERVICE_URL", "http://localhost:8002")
    INVENTORY_SERVICE_URL: str = os.getenv("INVENTORY_SERVICE_URL", "http://localhost:8003")
    PAYMENT_SERVICE_URL: str = os.getenv("PAYMENT_SERVICE_URL", "http://localhost:8004")
    NOTIFICATION_SERVICE_URL: str = os.getenv("NOTIFICATION_SERVICE_URL", "http://localhost:8005")
    ANALYTICS_SERVICE_URL: str = os.getenv("ANALYTICS_SERVICE_URL", "http://localhost:8006")

    class Config:
        case_sensitive = True

settings = Settings()
