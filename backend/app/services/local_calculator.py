"""
Универсальный модуль парсинга локальных прайсов (CSV / Excel)"""
import pandas as pd
import os
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_FILE_PATH = os.path.join(BACKEND_DIR, ".env")

from backend.app.models.schemas import CargoRequest


class LocalCalculatorService:
    def __init__(self):
        # 1. ИСПРАВЛЕНИЕ ПУТИ К ПАПКЕ DATA
        # Текущий файл: backend/app/services/local_calculator.py
        current_file_path = os.path.abspath(__file__)
        # Поднимаемся на 3 уровня вверх: services -> app -> backend
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_file_path)))

        self.data_dir = os.path.join(backend_dir, "data")

        # Ищем файлы прайсов по ключевым словам
        self.rttk_path = self._find_file_path(["rttk", "рттк", "РТТК"])
        self.brl_path = self._find_file_path(["brl", "брл", "БРЛ"])

        # Контрольные логи при запуске сервера
        print(f"[LOG] Абсолютный путь к папке data: '{self.data_dir}'")
        print(f"[LOG] Найденный файл РТТК: '{self.rttk_path}'")
        print(f"[LOG] Найденный файл БРЛ: '{self.brl_path}'")

    def _find_file_path(self, keywords: list[str]) -> str:
        """Ищет файл в папке data, имя которого содержит любое из ключевых слов"""
        if not os.path.exists(self.data_dir):
            print(f"[ERROR] Папка не найдена: {self.data_dir}")
            return ""

        for file in os.listdir(self.data_dir):
            name_lower = file.lower()
            # Проверяем, подходит ли расширение
            if name_lower.endswith('.csv') or name_lower.endswith('.xlsx') or name_lower.endswith('.xls'):
                # Проверяем наличие любого из ключевых слов в названии файла
                if any(kw.lower() in name_lower for kw in keywords):
                    return os.path.join(self.data_dir, file)
        return ""

    def calculate_totals(self, cargo: CargoRequest) -> tuple[float, float]:
        """
        МАТЕМАТИЧЕСКИЙ РАСЧЕТ ПАРАМЕТРОВ ПАРТИИ ГРУЗА

        Входные параметры из объекта cargo (тип CargoRequest):
        - cargo.length:   Длина одного места в сантиметрах (см)
        - cargo.width:    Ширина одного места в сантиметрах (см)
        - cargo.height:   Высота одного места в сантиметрах (см)
        - cargo.weight:   Вес одного места в килограммах (кг)
        - cargo.quantity: Количество одинаковых грузовых мест в партии (шт)
        """

        # 1. РАСЧЕТ ОБЩЕГО ОБЪЕМА ПАРТИИ (в кубических метрах)
        #
        # Шаг А: (cargo.length * cargo.width * cargo.height)
        # Перемножаем три линейных измерения одного грузового места.
        # Результат получается в КУБИЧЕСКИХ САНТИМЕТРАХ (см³).
        #
        # Шаг Б: / 1_000_000.0
        # расчет тарифов в КУБИЧЕСКИХ МЕТРАХ (м³).
        # Переводим см³ в м³. В одном кубическом метре содержится ровно 1 000 000 см³
        # (так как 1м = 100см, следовательно: 100см * 100см * 100см = 1 000 000 см³).
        #
        # Шаг В: * cargo.quantity
        # Умножаем полученный объем одного места на общее количество мест в партии,
        # чтобы узнать, какой суммарный объем груз займет в кузове автомобиля.
        total_volume = ((cargo.length * cargo.width * cargo.height) / 1_000_000.0) * cargo.quantity

        # 2. РАСЧЕТ ОБЩЕГО ВЕСА ПАРТИИ (в килограммах)
        #
        # Берем чистый физический вес одного места (в кг) и умножаем на число мест.
        # Полученное значение total_weight бэкенд использует для автоматического
        # подбора грузоподъемности машины (например, если вес > 1500 кг, то машина 1.5т
        # уже не подойдет, и алгоритм выберет тариф для трехтонника).
        total_weight = cargo.weight * cargo.quantity

        # 3. ОКРУГЛЕНИЕ РЕЗУЛЬТАТОВ ДЛЯ СТАБИЛЬНОСТИ ИНТЕРФЕЙСА
        #
        # При делении дробных чисел в Python (из-за специфики архитектуры процессора float)
        # могут возникать длинные "хвосты" после запятой (например: 0.9600000000004).
        # - Объем округляем до 4 знаков после запятой (точность до литра: 0.0001 м³ = 1 литр).
        # - Физический вес округляем до 2 знаков после запятой (точность до 10 грамм).
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
        """Универсально загружает CSV или Excel в Pandas DataFrame с автоподбором кодировки"""
        if not file_path or not os.path.exists(file_path):
            return pd.DataFrame()

        ext = os.path.splitext(file_path)[1].lower()
        try:
            if ext in ['.xlsx', '.xls']:
                return pd.read_excel(file_path, header=None)
            else:
                # Для CSV пробуем utf-8, если падает или читает некорректно — берем windows-1251
                for encoding in ['utf-8', 'windows-1251', 'cp1251']:
                    for separator in [';', ',']:
                        try:
                            df = pd.read_csv(file_path, header=None, sep=separator, encoding=encoding)
                            # Проверяем, что файл не пустой и успешно разбился на колонки
                            if not df.empty and df.shape[1] >= 2:
                                return df
                        except Exception:
                            continue
                return pd.DataFrame()
        except Exception as e:
            print(f"Ошибка при чтении файла {file_path}: {e}")
            return pd.DataFrame()

    def _find_price_in_data(self, file_path: str, from_loc: str, to_loc: str, capacity: float) -> float:
        df = self._load_dataframe(file_path)
        if df.empty:
            return 0.0

        f_city = self._clean_city_name(from_loc)
        t_city = self._clean_city_name(to_loc)

        # Подготавливаем маркеры поиска машины (например: "1,5" и "1.5")
        cap_str_comma = f"{capacity}".replace(".", ",")
        cap_str_dot = f"{capacity}"

        current_route_match = False
        price_column_idx = 1  # По умолчанию 1-я колонка с ценой (индекс 1 в Pandas)

        for _, row in df.iterrows():
            # Берем значение первой ячейки
            cell_value = str(row.iloc[0]).strip().lower() if pd.notna(row.iloc[0]) else ""
            if not cell_value:
                continue

            # ПУНКТ 1 и 3: Если в строке есть оба города, мы ТОЧНО нашли шапку нужного маршрута
            if f_city in cell_value and t_city in cell_value:
                current_route_match = True

                # Определяем направление (прямое или обратное)
                # Если город отправления написан в строке прайса раньше, чем город прибытия:
                if cell_value.find(f_city) < cell_value.find(t_city):
                    price_column_idx = 1  # Прямое направление
                else:
                    price_column_idx = 2  # Обратное направление (через "/" в БРЛ)
                continue

            # Если мы встретили строку другого маршрута (города не совпали, но это явно шапка),
            # сбрасываем флаг, чтобы не собирать чужие цены
            elif ("–" in cell_value or "—" in cell_value or "-" in cell_value or "/" in cell_value) and (
                    "грузоподъемностью" not in cell_value):
                current_route_match = False
                continue

            # Если мы находимся внутри нужного маршрута — ищем строку автомобиля
            if current_route_match:
                if "грузоподъемностью" in cell_value and (cap_str_comma in cell_value or cap_str_dot in cell_value):
                    # ПУНКТ 2: Проверяем, существует ли нужная колонка цены в этой строке
                    if len(row) > price_column_idx:
                        raw_price = row.iloc[price_column_idx]

                        # Если ячейка пустая (например, в РТТК нет 2-й колонки для обратного пути)
                        if pd.isna(raw_price) or str(raw_price).strip() == "":
                            return 0.0

                        # Если это число, приводим к float и возвращаем
                        if isinstance(raw_price, (int, float)):
                            return float(raw_price)

                        # Если строка (очищаем от пробелов, кавычек и валюты)
                        cleaned_price = (
                            str(raw_price)
                            .replace(" ", "")
                            .replace("\xa0", "")
                            .replace("₽", "")
                            .replace('"', '')
                            .replace(",", ".")
                            .strip()
                        )
                        try:
                            return float(cleaned_price)
                        except ValueError:
                            continue

                    else:
                        # Если у компании (например, РТТК) нет этой колонки для обратного направления
                        return 0.0

        return 0.0


    def calculate_rttk(self, cargo: CargoRequest) -> dict:
        total_volume, total_weight = self.calculate_totals(cargo)
        capacity = self._determine_required_capacity(total_weight)

        price = self._find_price_in_data(self.rttk_path, cargo.from_location, cargo.to_location, capacity)

        if price > 0:
            return {
                "company": "РТТК",
                "price": price,
                "term": "7 дней",
                "oversized": cargo.length > 200 or cargo.width > 200 or cargo.height > 200 or cargo.weight > 1500,
                "description": f"Региональный авторейс РТТК (Машина {capacity}т)"
            }
        else:
            # Возвращаем дефолтные типы, удовлетворяющие старой схеме Pydantic
            return {
                "company": "РТТК (Маршрут не обслуживается)",
                "price": 0.0,
                "term": "—",
                "oversized": False,
                "description": f"Компания РТТК таким путем выбранный транспорт ({capacity}т) не возит."
            }

    def calculate_brl(self, cargo: CargoRequest) -> dict:
        total_volume, total_weight = self.calculate_totals(cargo)
        capacity = self._determine_required_capacity(total_weight)

        price = self._find_price_in_data(self.brl_path, cargo.from_location, cargo.to_location, capacity)

        if price > 0:
            return {
                "company": "БРЛ",
                "price": price,
                "term": "6 дней",
                "oversized": cargo.length > 200 or cargo.width > 200 or cargo.height > 200 or cargo.weight > 1500,
                "description": f"Магистральный рейс БРЛ (Машина {capacity}т)"
            }
        else:
            return {
                "company": "БРЛ (Маршрут не обслуживается)",
                "price": 0.0,
                "term": "—",
                "oversized": False,
                "description": f"Компания БРЛ таким путем выбранный транспорт ({capacity}т) не возит."
            }