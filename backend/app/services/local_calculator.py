"""
Универсальный модуль парсинга локальных прайсов (CSV / Excel)"""

import pandas as pd
import os
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_FILE_PATH = os.path.join(BACKEND_DIR, ".env")

from backend.app.models.schemas import CargoRequest

class LocalCalculatorService:
    def __init__(self):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.data_dir = os.path.join(base_dir, "data")

        # Мы ищем файлы как с расширением .csv, так и с .xlsx / .xls
        self.rttk_path = self._find_file_path("price_rttk")
        self.brl_path = self._find_file_path("price_brl")

    def _find_file_path(self, base_name: str) -> str:
        """Ищет файл в папке data с любым поддерживаемым расширением (регистронезависимо)"""
        if not os.path.exists(self.data_dir):
            return ""

        for file in os.listdir(self.data_dir):
            name_lower = file.lower()
            if name_lower.startswith(base_name.lower()):
                if name_lower.endswith('.csv') or name_lower.endswith('.xlsx') or name_lower.endswith('.xls'):
                    return os.path.join(self.data_dir, file)
        return ""

    def calculate_totals(self, cargo: CargoRequest) -> tuple[float, float]:
        """Подсчет общих параметров партии груза"""
        total_volume = ((cargo.length * cargo.width * cargo.height) / 1_000_000.0) * cargo.quantity
        total_weight = cargo.weight * cargo.quantity
        return round(total_volume, 4), round(total_weight, 2)

    def _clean_city_name(self, city: str) -> str:
        """Приведение городов к единому упрощенному виду"""
        c = city.lower().strip()
        if "санкт-петербург" in c or "санкт петербург" in c or "питербург" in c:
            return "питербург"
        return c

    def _determine_required_capacity(self, weight: float) -> float:
        """Определение тоннажа машины по весу груза"""
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

    def _load_dataframe(self, file_path: str) -> pd.DataFrame:
        """Универсально загружает CSV или Excel в Pandas DataFrame"""
        if not file_path or not os.path.exists(file_path):
            return pd.DataFrame()

        ext = os.path.splitext(file_path)[1].lower()
        try:
            if ext in ['.xlsx', '.xls']:
                # Читаем Excel без заголовков, чтобы анализировать строки вручную
                return pd.read_excel(file_path, header=None)
            else:
                # Читаем CSV, пробуем сначала точку с запятой, затем запятую
                try:
                    return pd.read_csv(file_path, header=None, sep=';', encoding='utf-8')
                except Exception:
                    return pd.read_csv(file_path, header=None, sep=',', encoding='utf-8')
        except Exception as e:
            print(f"Ошибка при чтении файла {file_path}: {e}")
            return pd.DataFrame()

    def _find_price_in_data(self, file_path: str, from_loc: str, to_loc: str, capacity: float,
                            price_column_idx: int = 1) -> float:
        df = self._load_dataframe(file_path)
        if df.empty:
            return 0.0

        f_city = self._clean_city_name(from_loc)
        t_city = self._clean_city_name(to_loc)

        # Формируем поисковые маркеры для машины
        cap_str_comma = f"{capacity}".replace(".", ",")
        cap_str_dot = f"{capacity}"

        current_route_match = False

        # Итерируемся по строкам таблицы
        for _, row in df.iterrows():
            # Берем первую ячейку строки как маркер маршрута или машины
            cell_value = str(row.iloc[0]).strip().lower() if pd.notna(row.iloc[0]) else ""
            if not cell_value:
                continue

            # Проверяем, является ли строка объявлением маршрута
            if "–" in cell_value or "-" in cell_value or "/" in cell_value:
                if f_city in cell_value and t_city in cell_value:
                    current_route_match = True
                else:
                    current_route_match = False
                continue

            # Если мы внутри нужного маршрута, ищем нужную машину
            if current_route_match:
                if "грузоподъемностью" in cell_value and (cap_str_comma in cell_value or cap_str_dot in cell_value):
                    if len(row) > price_column_idx:
                        raw_price = row.iloc[price_column_idx]
                        if pd.notna(raw_price):
                            # Если это уже число, просто отдаем его
                            if isinstance(raw_price, (int, float)):
                                return float(raw_price)
                            # Если это строка (например "140 000,00"), очищаем ее
                            cleaned_price = str(raw_price).replace(" ", "").replace("\xa0", "").replace(",",
                                                                                                        ".").strip()
                            try:
                                return float(cleaned_price)
                            except ValueError:
                                continue
        return 0.0

    def calculate_rttk(self, cargo: CargoRequest) -> dict:
        _, total_weight = self.calculate_totals(cargo)
        capacity = self._determine_required_capacity(total_weight)

        price = self._find_price_in_data(self.rttk_path, cargo.from_location, cargo.to_location, capacity,
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
        _, total_weight = self.calculate_totals(cargo)
        capacity = self._determine_required_capacity(total_weight)

        price = self._find_price_in_data(self.brl_path, cargo.from_location, cargo.to_location, capacity,
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