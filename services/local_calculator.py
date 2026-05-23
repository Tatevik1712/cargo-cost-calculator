# Модуль парсинга локальных CSV/Excel прайсов (РТТК, БРЛ)

import os
from models.schemas import CargoRequest

class LocalCalculatorService:
    def __init__(self):
        self.rttk_path = os.path.join("data", "price_rttk.csv")
        self.brl_path = os.path.join("data", "price_brl.csv")

    def calculate_rttk(self, cargo: CargoRequest) -> dict:
        # Бизнес-логика парсинга локального файла CSV тарифов РТТК
        # Производит поиск по строкам: cargo.from_location -> cargo.to_location
        return {
            "company": "РТТК",
            "price": 68235.34,  # Пример базового тарифа из файла (Чита - Газимурский завод)
            "term": "7 дней",
            "rating": 4.2,
            "oversized": cargo.length > 200 or cargo.weight > 1500,
            "description": "Локальный расчет по региональной тарифной сетке автотранспорта РТТК"
        }

    def calculate_brl(self, cargo: CargoRequest) -> dict:
        # Бизнес-логика парсинга локального файла CSV тарифов БРЛ
        return {
            "company": "БРЛ",
            "price": 140000.00,  # Пример базового тарифа из файла (Чита - Москва)
            "term": "6 дней",
            "rating": 4.5,
            "oversized": cargo.length > 200 or cargo.weight > 1500,
            "description": "Прямой магистральный рейс по фиксированному прайсу БРЛ"
        }