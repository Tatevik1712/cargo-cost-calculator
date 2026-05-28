import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import os
import sys

# Вычисляем путь к папке backend/ (на уровень выше, чем app/)
# и добавляем его в системные пути поиска модулей Python
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from backend.app.services.dellin_client import DellinAPIClient
from backend.config.settings import settings
from backend.app.models.schemas import CargoRequest, CalculationResponse, OfferResponse
from backend.app.services.local_calculator import LocalCalculatorService

app = FastAPI(
    title="Cargo Cost Calculator API",
    description="Асинхронный бэкенд агрегации тарифов ТК (Деловые Линии, РТТК, БРЛ)",
    version="1.0.0"
)

# Настройка CORS-политики
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # На продакшене рекомендуется заменить на домен приложения
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/v1/calculate", response_model=CalculationResponse)
async def process_calculation(request: CargoRequest):
    dellin_client = DellinAPIClient()
    local_calc = LocalCalculatorService()

    # Расчет общих параметров партии груза
    total_volume, total_weight = local_calc.calculate_totals(request)

    # Запускаем тяжелый сетевой запрос к API Деловых Линий асинхронно
    dellin_task = asyncio.create_task(dellin_client.calculate(request))

    # Локальные расчеты РТТК и БРЛ по файлам выполняются параллельно
    rttk_offer = local_calc.calculate_rttk(request)
    brl_offer = local_calc.calculate_brl(request)

    # Ожидаем ответ от сервера Деловых Линий (уже без VPN и SSL блокировок)
    dellin_res = await dellin_task

    offers = []

    # 1. ИСПРАВЛЕНО: Проверяем статус "available" в соответствии с новой архитектурой клиента
    if dellin_res and dellin_res.get("status") == "available":
        offers.append(
            OfferResponse(
                company="Деловые Линии",
                price=dellin_res["price"],
                term=dellin_res["term"],
                oversized=dellin_res["oversized"],
                description="Прямая интеграция по API"
            )
        )
    elif dellin_res:
        # Если ДЛ недоступны (ошибка маршрута/города), мы все равно можем передать карточку с ошибкой
        # Если ваша схема OfferResponse строго требует валидных данных, этот блок можно пропустить
        print(f"[ИНФО] Деловые Линии вернули статус: {dellin_res.get('error_message')}")

    # Добавляем результаты внутренних ТК
    offers.append(OfferResponse(**rttk_offer))
    offers.append(OfferResponse(**brl_offer))

    # Сортируем все доступные ТК по цене (от дешевых к дорогим)
    offers.sort(key=lambda x: x.price)

    # Формирование рекомендации (Алгоритм выбора лучшего предложения)
    recommendation = None
    if len(offers) >= 2:
        recommendation = (
            f"Самый бюджетный вариант предоставляет ТК '{offers[0].company}' ({offers[0].price} руб.). "
            f"Для минимизации рисков и быстрой доставки рассмотрите '{offers[1].company}'."
        )

    # 2. ИСПРАВЛЕНО: Возвращаем динамический отсортированный массив offers вместо статичных rttk/brl
    return CalculationResponse(
        total_volume=total_volume,
        total_weight=total_weight,
        search_parameters=request,
        offers=offers,  # ТЕПЕРЬ ТУТ ВСЕ 3 КОМПАНИИ (ЕСЛИ ДЛ ДОСТУПНЫ)
        recommendation=recommendation
    )


if __name__ == "__main__":
    # Запуск Uvicorn-сервера
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)