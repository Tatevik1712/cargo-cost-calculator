export type Carrier = "dl" | "rttk" | "brl";

export interface CalcInput {
  from: string;
  to: string;
  weight: number; // кг за одно место
  length: number; // см
  width: number;
  height: number;
  quantity: number;
  type: "auto" | "express";
}

export interface CarrierResult {
  carrier: Carrier;
  name: string;
  price: number | null;
  days: number | null; // или строка, в зависимости от ответа бэкенда ("5 дней")
  note?: string;
  oversized?: boolean;
}

/**
 * Возвращает фиксированный список городов для выпадающих списков.
 * Избавляет от импорта старого файла '@ /data/prices'.
 */
export function getAllCities(): string[] {
  return [
    "Благовещенск",
    "Борзя",
    "Быстринский ГОК",
    "Газимурский завод",
    "Екатеринбург",
    "Иваново",
    "Иркутск",
    "Москва",
    "Санкт-Петербург", // учтем опечатку "Питербург"
    "Чита"
  ].sort((a, b) => a.localeCompare(b, "ru"));
}

/**
 * Асинхронная функция для отправки данных на FastAPI бэкенд
 */
export async function calculateOnBackend(input: CalcInput): Promise<{
  results: CarrierResult[];
  volume: number;
  totalWeight: number;
  oversized: boolean;
}> {
  // Вычисляем базовые параметры на фронтенде для мгновенного отображения (по желанию)
  const volume = (input.length * input.width * input.height * input.quantity) / 1_000_000;
  const totalWeight = input.weight * input.quantity;
  const oversized = input.length > 200 || input.width > 200 || input.height > 200 || input.weight > 1500;

  try {
    // Делаем запрос к вашему FastAPI серверу
    // Замените URL на ваш рабочий адрес бэкенда, если он отличается
    const response = await fetch("http://localhost:8000/api/calculate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from_location: input.from,
        to_location: input.to,
        length: input.length,
        width: input.width,
        height: input.height,
        weight: input.weight,
        quantity: input.quantity,
        type: input.type, // Передаем тип (auto/express), если бэкенд его учитывает
      }),
    });

    if (!response.ok) {
      throw new Error("Ошибка при получении данных с сервера расчетов");
    }

    const data = await response.json();
    
    // Бэкенд возвращает результаты. Мапим их под интерфейс фронтенда, если ключи отличаются
    // Предполагаем, что бэкенд возвращает { results: [...] }
    return {
      results: data.results,
      volume,
      totalWeight,
      oversized,
    };
  } catch (error) {
    console.error("Calculator backend error:", error);
    // Возвращаем пустой результат в случае падения сети, чтобы приложение не падало
    return {
      results: [],
      volume,
      totalWeight,
      oversized,
    };
  }
}