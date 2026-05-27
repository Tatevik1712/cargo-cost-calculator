# Модуль интеграции с API «Деловых Линий»

import httpx
from backend.config.settings import settings
from backend.app.models.schemas import CargoRequest

class DellinAPIClient:
    def __init__(self):
        self.app_key = settings.DELLIN_APP_KEY
        self.api_url = "https://api.dellin.ru/v2/calculator.json"

    async def calculate(self, cargo: CargoRequest) -> dict:
        # Проверка бизнес-правила из ТЗ на негабарит (oversized)
        is_oversized = (
                cargo.length > 200.0 or
                cargo.width > 200.0 or
                cargo.height > 200.0 or
                (cargo.weight / cargo.quantity) > 1500.0
        )

        # Вычисление суммарного объема груза в кубических метрах
        total_volume = (cargo.length * cargo.width * cargo.height * cargo.quantity) / 1_000_000.0

        # Построение структуры JSON для API Деловых Линий (метод v2/calculator.json)
        payload = {
            "appkey": self.app_key,
            "delivery": {
                "deliveryType": {"type": cargo.delivery_type},
                "derival": {
                    "variant": "address",
                    "address": {"search": cargo.from_location}
                },
                "arrival": {
                    "variant": "address",
                    "address": {"search": cargo.to_location}
                }
            },
            "cargo": {
                "quantity": cargo.quantity,
                "length": cargo.length / 100.0,  # Конвертация см -> метры
                "width": cargo.width / 100.0,
                "height": cargo.height / 100.0,
                "totalWeight": cargo.weight * cargo.quantity,  # Общий вес партии в кг
                "totalvolume": total_volume,
                "oversizedWeight": cargo.weight if is_oversized else 0,
                "oversizedVolume": total_volume if is_oversized else 0
            }
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.api_url, json=payload, timeout=7.0)
                if response.status_code == 200:
                    data = response.json()
                    if "errors" in data:
                        return {"success": False, "error": data["errors"]}

                    price = data.get("data", {}).get("price", 0.0)
                    return {
                        "success": True,
                        "price": float(price),
                        "term": "5 дней",  # Срок доставки (в проде парсится из блока OrderDates)
                        "oversized": is_oversized
                    }
                return {"success": False, "error": f"Ошибка ДЛ: статус {response.status_code}"}
            except httpx.RequestError as e:
                return {"success": False, "error": f"Сбой сети при запросе к ДЛ: {str(e)}"}