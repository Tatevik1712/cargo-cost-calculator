# -*- coding: utf-8 -*-
import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

# Вычисляем путь к папке backend/ (на один уровень выше, чем папка config)
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_FILE_PATH = os.path.join(BACKEND_DIR, ".env")


class Settings(BaseSettings):
    DELLIN_APP_KEY: str
    HOST: str
    PORT: int

    # Указываем Pydantic точный абсолютный путь к файлу .env
    model_config = SettingsConfigDict(
        env_file=ENV_FILE_PATH,
        env_file_encoding="utf-8",
        extra="ignore"  # Игнорировать другие переменные в .env, если они есть
    )


settings = Settings()