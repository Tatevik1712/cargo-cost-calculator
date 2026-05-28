# Модуль интеграции с API «Деловых Линий»

import urllib.request
import urllib.error
import asyncio
import logging
import json
import ssl
from backend.config.settings import settings
from backend.app.models.schemas import CargoRequest

logger = logging.getLogger("backend.dellin_client")
logger.setLevel(logging.INFO)


class DellinAPIClient:
    def __init__(self):
        self.app_key = settings.DELLIN_APP_KEY
        self.api_url = "https://api.dellin.ru/v2/calculator.json"

    async def calculate(self, cargo: CargoRequest) -> dict:
        logger.info(f"===> НАЧАЛО РАСЧЕТА ДЛ: {cargo.from_location} -> {cargo.to_location}")

        # Проверка бизнес-правила из ТЗ на негабарит (oversized)
        is_oversized = (
                cargo.length > 200.0 or
                cargo.width > 200.0 or
                cargo.height > 200.0 or
                (cargo.weight / cargo.quantity) > 1500.0
        )

        # Вычисление суммарного объема груза в кубических метрах
        total_volume = (cargo.length * cargo.width * cargo.height * cargo.quantity) / 1_000_000.0
        dl_delivery_type = "avia" if cargo.delivery_type == "express" else "auto"

        # Построение структуры JSON строго по спецификации v2/calculator.json
        payload = {
            "appkey": self.app_key,
            "delivery": {
                "deliveryType": {"type": dl_delivery_type},
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
                "length": cargo.length / 100.0,
                "width": cargo.width / 100.0,
                "height": cargo.height / 100.0,
                "totalWeight": cargo.weight * cargo.quantity,
                "totalVolume": total_volume,
                "oversizedWeight": cargo.weight if is_oversized else 0,
                "oversizedVolume": total_volume if is_oversized else 0
            }
        }

        # Имитируем заголовки полноценного браузера macOS, чтобы пройти Qrator
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

        # Превращаем данные в байты для отправки
        data_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")

        # Создаем SSL-контекст, который полностью игнорирует локальные проблемы верификации
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        # Синхронная функция выполнения системного запроса
        def _sync_request():
            req = urllib.request.Request(self.api_url, data=data_bytes, headers=headers, method="POST")
            with urllib.request.urlopen(req, context=ctx, timeout=10.0) as response:
                return response.read().decode("utf-8")

        try:
            # Выполняем запрос в неблокирующем потоке (чтобы FastAPI работал асинхронно)
            loop = asyncio.get_event_loop()
            response_text = await loop.run_in_executor(None, _sync_request)

            data = json.loads(response_text)
            logger.info(f"[ДЛ СЫРЫЕ ДАННЫЕ ОТВЕТА]: {json.dumps(data, ensure_ascii=False)}")

            if "errors" in data or "errors" in data.get("metadata", {}):
                err_msg = data.get("errors", [{}])[0].get("message", "Ошибка валидации данных ДЛ")
                return {
                    "company": "Деловые Линии",
                    "status": "unavailable",
                    "error_message": f"ДЛ: {err_msg}",
                    "price": 0,
                    "oversized": is_oversized
                }

            price = data.get("data", {}).get("price", 0.0)
            return {
                "company": "Деловые Линии",
                "status": "available",
                "price": float(price),
                "term": "5 дней",
                "description": "Сборный груз через терминалы ДЛ",
                "oversized": is_oversized,
                "error_message": None
            }

        except urllib.error.HTTPError as e:
            # Если сервер ДЛ вернул код ошибки (например 400 или 500)
            err_body = e.read().decode("utf-8", errors="ignore")
            logger.error(f"[ДЛ СЕРВЕР ВЕРНУЛ ОШИБКУ HTTP]: {e.code} - {err_body}")
            return {
                "company": "Деловые Линии",
                "status": "unavailable",
                "error_message": f"Ошибка ДЛ: код {e.code}",
                "price": 0,
                "oversized": is_oversized
            }
        except Exception as e:
            # Любые другие сетевые или системные сбои
            logger.error(f"[ДЛ СИСТЕМНЫЙ СБОЙ]: {str(e)}")
            return {
                "company": "Деловые Линии",
                "status": "unavailable",
                "error_message": "Не удалось установить защищенное соединение с ДЛ",
                "price": 0,
                "oversized": is_oversized
            }