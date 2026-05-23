from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DELLIN_APP_KEY: str
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Автоматически подтягивает данные из файла .env в корне проекта
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()