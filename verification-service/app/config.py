"""Configuration management for the verification service."""

from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # Database
    database_url: str = "postgresql://postgres:postgres@db:5432/verification_db"

    # Security
    private_key_path: str = "/app/keys/private_key.pem"
    hmac_secret_key: str = "your-hmac-secret-key-change-in-production"
    storage_encryption_key: str = "your-32-byte-storage-key-change-this-in-production!!"

    # API
    api_prefix: str = "/api/v1"
    debug: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
