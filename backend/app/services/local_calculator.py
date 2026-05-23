# Модуль парсинга локальных CSV/Excel прайсов (РТТК, БРЛ)
# services/local_calculator.py
import os
import csv
from backend.app.models.schemas import CargoRequest


class LocalCalculatorService:
    def __init__(self):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.rttk_path = os.path.join(base_dir, "data", "price_rttk.csv")
        self.brl_path = os.path.join(base_dir, "data", "price_brl.csv")

    def calculate_totals(self, cargo: CargoRequest) -> tuple[float, float]:
        """
        Отдельная функция для подсчета общих параметров груза.
        Возвращает кортеж: (total_volume в м³, total_weight в кг)
        """
        # Формула объема: (Длина * Ширина * Высота) / 1 000 000 * Количество
        total_volume = ((cargo.length * cargo.width * cargo.height) / 1_000_000.0) * cargo.quantity
        # Формула общего веса
        total_weight = cargo.weight * cargo.quantity

        # Округляем для красоты и точности (объем до 4 знаков, вес до 2)
        return round(total_volume, 4), round(total_weight, 2)

    def _clean_city_name(self, city: str) -> str:
        """Приводит названия городов к единому упрощенному виду для надежного поиска"""
        c = city.lower().strip()
        if "санкт-петербург" in c or "санкт петербург" in c or "питербург" in c:
            return "питербург"  # Учитываем опечатку в вашем CSV БРЛ
        return c

    def _parse_russian_float(self, val_str: str) -> float:
        """Конвертирует строку вида '140 000,00' в валидный float 140000.0"""
        if not val_str:
            return 0.0
        cleaned = val_str.replace(" ", "").replace("\xa0", "").replace(",", ".").strip()
        try:
            return float(cleaned)
        except ValueError:
            return 0.0

    def _determine_required_capacity(self, weight: float) -> float:
        """Определяет категорию машины по весу груза (в кг)"""
        weight_tons = weight / 1000.0
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

    def _find_price_in_csv(self, file_path: str, from_loc: str, to_loc: str, capacity: float,
                           price_column_idx: int = 1) -> float:
        if not os.path.exists(file_path):
            return 0.0

        f_city = self._clean_city_name(from_loc)
        t_city = self._clean_city_name(to_loc)

        cap_str = f"{capacity}".replace(".", ",")
        target_vehicle = f"грузоподъемностью {cap_str} тонн"

        current_route_match = False

        with open(file_path, mode='r', encoding='utf-8') as f:
            reader = csv.reader(f, delimiter=';')
            for row in reader:
                if not row or not row[0]:
                    continue

                line = row[0].strip().lower()

                if "–" in line or "-" in line:
                    if f_city in line and t_city in line:
                        current_route_match = True
                    else:
                        current_route_match = False
                    continue

                if current_route_match:
                    if target_vehicle in line:
                        if len(row) > price_column_idx:
                            return self._parse_russian_float(row[price_column_idx])
        return 0.0

    def calculate_rttk(self, cargo: CargoRequest) -> dict:
        # Используем новую функцию для определения общего веса груза 👇
        _, total_weight = self.calculate_totals(cargo)
        capacity = self._determine_required_capacity(total_weight)

        price = self._find_price_in_csv(self.rttk_path, cargo.from_location, cargo.to_location, capacity,
                                        price_column_idx=1)

        final_price = price if price > 0 else 68235.34

        return {
            "company": "РТТК",
            "price": final_price,
            "term": "7 дней",
            "rating": 4.2,
            "oversized": cargo.length > 200 or cargo.weight > 1500,
            "description": f"Региональный авторейс РТТК (Машина {capacity}т)"
        }

    def calculate_brl(self, cargo: CargoRequest) -> dict:
        # Используем новую функцию для определения общего веса груза 👇
        _, total_weight = self.calculate_totals(cargo)
        capacity = self._determine_required_capacity(total_weight)

        price = self._find_price_in_csv(self.brl_path, cargo.from_location, cargo.to_location, capacity,
                                        price_column_idx=1)

        final_price = price if price > 0 else 140000.00

        return {
            "company": "БРЛ",
            "price": final_price,
            "term": "6 дней",
            "rating": 4.5,
            "oversized": cargo.length > 200 or cargo.weight > 1500,
            "description": f"Магистральный рейс БРЛ (Машина {capacity}т)"
        }