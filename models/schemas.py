# Pydantic-модели (схемы запросов от Flutter и ответов)
from pydantic import BaseModel, Field
from typing import List, Optional

class CargoRequest(BaseModel):
    from_location: str = Field(..., example="Москва", description="Город отправления")
    to_location: str = Field(..., example="Чита", description="Город назначения")
    length: float = Field(..., example=120.0, description="Длина одного места в см")
    width: float = Field(..., example=80.0, description="Ширина одного места в см")
    height: float = Field(..., example=100.0, description="Высота одного места в см")
    weight: float = Field(..., example=250.0, description="Общий вес груза в кг")
    quantity: int = Field(default=1, example=1, description="Количество грузовых мест")
    delivery_type: str = Field(default="auto", example="auto", description="Тип доставки (auto, express, avia)")

class OfferResponse(BaseModel):
    company: str             # Название ТК (Деловые Линии, РТТК, БРЛ)
    price: float             # Итоговая цена перевозки в рублях
    term: str                # Срок доставки (например, "5 дней")
    rating: float            # Средняя оценка/рейтинг компании
    oversized: bool          # Флаг, является ли груз негабаритным для этой ТК
    description: str         # Комментарий или описание тарифа

class CalculationResult(BaseModel):
    status: str
    search_parameters: CargoRequest
    offers: List[OfferResponse]
    recommendation: Optional[str] = None  # Интеллектуальный совет калькулятора