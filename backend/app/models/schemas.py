# Pydantic-модели (схемы запросов от Flutter и ответов)
from pydantic import BaseModel, Field
from typing import List, Optional

class CargoRequest(BaseModel):
    from_location: str = Field(..., example="Москва", description="Город отправления")
    to_location: str = Field(..., example="Чита", description="Город назначения")
    length: float = Field(..., example=120.0, description="Длина одного места в см")
    width: float = Field(..., example=80.0, description="Ширина одного места в см")
    height: float = Field(..., example=100.0, description="Высота одного места в см")
    weight: float = Field(..., example=250.0, description="Вес одного места в кг")  # Исправлено: именно ОДНОГО места, так как общий вес посчитает бэкенд
    quantity: int = Field(default=1, example=1, description="Количество грузовых мест")
    delivery_type: str = Field(default="auto", example="auto", description="Тип доставки (auto, express, avia)")

class OfferResponse(BaseModel):
    company: str = Field(..., example="РТТК", description="Название ТК (Деловые Линии, РТТК, БРЛ)")
    price: float = Field(..., example=68235.34, description="Итоговая цена перевозки в рублях")
    term: str = Field(..., example="7 дней", description="Срок доставки груза")
    oversized: bool = Field(..., description="Флаг, является ли груз негабаритным")
    description: str = Field(..., description="Комментарий или описание тарифа (например, тип машины)")

class CalculationResponse(BaseModel):
    status: str = Field(default="success", example="success", description="Статус выполнения запроса")
    total_volume: float = Field(..., example=0.96, description="Посчитанный бэкендом общий объём партии (м³)")
    total_weight: float = Field(..., example=250.0, description="Посчитанный бэкендом общий вес всей партии (кг)")
    search_parameters: CargoRequest = Field(..., description="Исходные параметры поиска для верификации")
    offers: List[OfferResponse] = Field(..., description="Список предложений от разных транспортных компаний")
    recommendation: Optional[str] = Field(None, example="РТТК дешевле всего, но Деловые Линии доставят быстрее.", description="Интеллектуальный совет калькулятора")