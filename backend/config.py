from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    gemini_api_key: str
    model_id: str = "gemini-3.1-flash-lite-preview"
    app_env: str = "development"
    cors_origins: str = "http://localhost:5173"

    # Firebase Admin SDK — credentials file path
    firebase_project_id: str = ""
    firebase_credentials_path: str = "firebase_credentials.json"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
