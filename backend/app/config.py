from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Application
    app_name: str = "GSCC — Gestión de Procesos"
    debug: bool = False
    secret_key: str = "change-me-in-production"

    # JWT
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30

    # Database
    database_url: str = "postgresql+asyncpg://gscc:gscc_password@db:5432/gscc_db"
    database_sync_url: str = "postgresql+psycopg2://gscc:gscc_password@db:5432/gscc_db"

    # Celery / Redis
    celery_broker_url: str = "redis://redis:6379/0"
    celery_result_backend: str = "redis://redis:6379/1"

    # File storage — absolute path inside the container (Docker volume mount)
    artifacts_path: str = "/data/artifacts"


settings = Settings()
