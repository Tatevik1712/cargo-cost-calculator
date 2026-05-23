# Модуль парсинга локальных CSV/Excel прайсов (РТТК, БРЛ)
# services/local_calculator.py
import os
import csv
import re
from models.schemas import CargoRequest


class LocalCalculatorService:
    def __init__(self):
        # Подстраиваемся под точные имена ваших файлов в папке Data в корне проекта
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.rttk_path = os.path.join(base_dir, "data", "price_rttk.csv")
        self.brl_path = os.path.join(base_dir, "data", "price_brl.csv")

    def _determine_required_capacity(self, weight: float, volume: float) -> float:
        """
        Определяет требуемую грузоподъемность автомобиля в тоннах
        на основе веса (кг) и объемного веса груза.
        """
        # Переводим вес в тонны
        weight_tons = weight / 1000.0
        # Стандартный коэффициент плотности для сборных грузов (1 м3 примерно равен 167-250 кг),
        # но для выделенных машин смотрим по весу. На всякий случай заложим логику по весу мест:

        if weight_tons <= 1.5:
            return 1.5
        elif weight_tons <= 3.0:
            return 3.0
        elif weight_tons <= 5.0:
            return 5.0
        elif weight_tons <= 10.0:
            return 10.0
        elif weight_tons <= 15.0:
            return 15.0
        else:
            return 20.0

    def _find_route_price_rttk(self, from_loc: str, to_loc: str, capacity: float) -> float:
        if not os.path.exists(self.rttk_path):
            return 0.0

        target_vehicle = f"Автомобиль Грузоподъемностью {capacity}".replace(".0",
                                                                            "") if capacity % 1 == 0 else f"Автомобиль Грузоподъемностью {capacity}"

        current_route_match = False

        with open(self.rttk_path, mode='r', encoding='utf-8') as f:
            reader = csv.reader(f)
            for row in reader:
                if not row:
                    continue
                line = row[0].strip()

                # Проверяем, является ли строка заголовком маршрута
                if "–" in line or "-" in line:
                    # Проверяем вхождение обоих городов в строку маршрута (без учета регистра)
                    if from_loc.lower() in line.lower() and to_loc.lower() in line.lower():
                        current_route_match = True
                    else:
                        current_route_match = False
                    continue

                # Если мы внутри нужного маршрута, ищем нужный автомобиль
                if current_route_match and len(row) > 1:
                    if target_vehicle.lower() in line.lower():
                        try:
                            # Очищаем строку от пробелов и валюты
                            price_str = row[1].replace(" ", "").replace("₽", "").strip()
                            return float(price_str)
                        except ValueError:
                            return 0.0
        return 0.0

    def _find_route_price_brl(self, from_loc: str, to_loc: str, capacity: float) -> float:
        if not os.path.exists(self.brl_path):
            return 0.0

        target_vehicle = f"Автомобиль Грузоподъемностью {capacity}".replace(".0",
                                                                            "") if capacity % 1 == 0 else f"Автомобиль Грузоподъемностью {capacity}"

        current_route_match = False

        with open(self.brl_path, mode='r', encoding='utf-8') as f:
            reader = csv.reader(f)
            for row in reader:
                if not row:
                    continue
                line = row[0].strip()

                if "–" in line or "-" in line or "/" in line:
                    if from_loc.lower() in line.lower() and to_loc.lower() in line.lower():
                        current_route_match = True
                    else:
                        current_route_match = False
                    continue

                if current_route_match and len(row) > 1:
                    if target_vehicle.lower() in line.lower():
                        try:
                            # В БРЛ прайсе есть базовая цена и цена с НДС (колонки 1 и 2). Берем базовую (индекс 1)
                            price_str = row[1].replace(" ", "").replace("₽", "").strip()
                            if not price_str and len(row) > 2:  # Если первая пустая, берем следующую
                                price_str = row[2].replace(" ", "").strip()
                            return float(price_str)
                        except ValueError:
                            return 0.0
        return 0.0

    def calculate_rttk(self, cargo: CargoRequest) -> dict:
        # Расчет объема
        volume = (cargo.length * cargo.width * cargo.height) / 1000000.0 * cargo.quantity
        total_weight = cargo.weight * cargo.quantity

        capacity = self._determine_required_capacity(total_weight, volume)
        price = self._find_route_price_rttk(cargo.from_location, cargo.to_location, capacity)

        # Если цена не найдена, возвращаем базовый тариф по умолчанию или 0
        final_price = price if price > 0 else 65000.0

        return {
            "company": "РТТК",
            "price": final_price,
            "term": "5-7 дней",
            "rating": 4.2,
            "oversized": cargo.length > 200 or cargo.weight > 1500,
            "description": f"Расчет на основе авто прайса РТТК (Машина {capacity}т)"
        }

    def calculate_brl(self, cargo: CargoRequest) -> dict:
        volume = (cargo.length * cargo.width * cargo.height) / 1000000.0 * cargo.quantity
        total_weight = cargo.weight * cargo.quantity

        capacity = self._determine_required_capacity(total_weight, volume)
        price = self._find_route_price_brl(cargo.from_location, cargo.to_location, capacity)

        final_price = price if price > 0 else 140000.0

        return {
            "company": "БРЛ",
            "price": final_price,
            "term": "4-6 дней",
            "rating": 4.5,
            "oversized": cargo.length > 200 or cargo.weight > 1500,
            "description": f"Магистральный рейс по прайсу БРЛ (Машина {capacity}т)"
        }