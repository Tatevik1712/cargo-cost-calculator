export type Carrier = "dl" | "rttk" | "brl";
import { API_BASE_URL } from "@/config";

export interface CalcInput {
  from: string;
  to: string;
  weight: number;
  length: number;
  width: number;
  height: number;
  quantity: number;
  type: "auto" | "express";
}

export interface CarrierResult {
  carrier: Carrier;
  name: string;
  price: number | null;
  days: number | null;
  note?: string;
  oversized?: boolean;
}

const FETCH_HEADERS = { "ngrok-skip-browser-warning": "true" };

/**
 * Больше НЕТ статического списка городов и НЕТ тихого fallback.
 * Если бэкенд недоступен — ошибка всплывает наружу, и это видно в UI/консоли.
 */
export async function getCitiesFromBackend(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/cities`, {
    headers: FETCH_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Не удалось получить список городов: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data.cities)) {
    throw new Error("Backend вернул некорректный формат списка городов");
  }

  return data.cities;
}

export async function calculateOnBackend(input: CalcInput): Promise<{
  results: CarrierResult[];
  volume: number;
  totalWeight: number;
  oversized: boolean;
}> {
  const volume = (input.length * input.width * input.height * input.quantity) / 1_000_000;
  const totalWeight = input.weight * input.quantity;
  const oversized = input.length > 200 || input.width > 200 || input.height > 200 || input.weight > 1500;

  const response = await fetch(`${API_BASE_URL}/api/v1/calculate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...FETCH_HEADERS,
    },
    body: JSON.stringify({
      from_location: input.from,
      to_location: input.to,
      length: input.length,
      width: input.width,
      height: input.height,
      weight: input.weight,
      quantity: input.quantity,
      type: input.type,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ошибка расчёта: HTTP ${response.status}`);
  }

  const data = await response.json();

  return {
    results: data.results,
    volume,
    totalWeight,
    oversized,
  };
}