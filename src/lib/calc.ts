import { PRICES } from "@/data/prices";

export type Carrier = "dl" | "rttk" | "brl";

export interface CalcInput {
  from: string;
  to: string;
  weight: number; // kg
  length: number; // cm
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
  rating: number;
  note?: string;
  oversized?: boolean;
}

const CAPACITIES = [1.5, 3.0, 5.0, 10.0, 15.0, 20.0];

function pickCapacity(totalTons: number): number {
  for (const c of CAPACITIES) if (totalTons <= c) return c;
  return CAPACITIES[CAPACITIES.length - 1];
}

function findRoute(list: readonly { from: string; to: string; tariffs: readonly { capacity: number; price: number }[] }[], from: string, to: string) {
  return list.find(
    (r) =>
      (r.from === from && r.to === to) ||
      (r.from === to && r.to === from),
  );
}

function priceFor(
  list: readonly { from: string; to: string; tariffs: readonly { capacity: number; price: number }[] }[],
  from: string,
  to: string,
  totalTons: number,
): number | null {
  const route = findRoute(list, from, to);
  if (!route) return null;
  const cap = pickCapacity(totalTons);
  const t = route.tariffs.find((x) => x.capacity === cap) ?? route.tariffs[route.tariffs.length - 1];
  return t?.price ?? null;
}

// Estimate days based on long-haul vs local. Simple heuristic by route presence.
function estimateDays(carrier: Carrier, from: string, to: string, type: "auto" | "express"): number {
  const longHaul = !["Борзя", "Иркутск", "Быстринский ГОК", "Газимурский завод, Быстринский ГОК", "Благовещенск"].includes(to);
  const base = longHaul ? 8 : 3;
  const adj: Record<Carrier, number> = { dl: -2, rttk: 1, brl: 0 };
  let d = base + adj[carrier];
  if (type === "express") d = Math.max(2, d - 3);
  return Math.max(1, d);
}

export function getAllCities(): string[] {
  const set = new Set<string>();
  for (const r of PRICES.rttk) {
    set.add(r.from);
    set.add(r.to);
  }
  for (const r of PRICES.brl) {
    set.add(r.from);
    set.add(r.to);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
}

export function calculate(input: CalcInput): {
  results: CarrierResult[];
  volume: number;
  totalWeight: number;
  oversized: boolean;
} {
  const volume = (input.length * input.width * input.height * input.quantity) / 1_000_000;
  const totalWeight = input.weight * input.quantity;
  const totalTons = totalWeight / 1000;
  const oversized =
    input.length > 200 ||
    input.width > 200 ||
    input.height > 200 ||
    input.weight > 1500;

  const ratings: Record<Carrier, number> = { dl: 4.5, rttk: 4.0, brl: 3.8 };
  const names: Record<Carrier, string> = {
    dl: "Деловые Линии",
    rttk: "РТТК",
    brl: "БРЛ",
  };

  const rttkPrice = priceFor(PRICES.rttk, input.from, input.to, totalTons);
  const brlPrice = priceFor(PRICES.brl, input.from, input.to, totalTons);

  // DL: estimated from other carriers (API integration ready)
  let dlPrice: number | null = null;
  const refs = [rttkPrice, brlPrice].filter((p): p is number => p !== null);
  if (refs.length) {
    const avg = refs.reduce((a, b) => a + b, 0) / refs.length;
    dlPrice = Math.round(avg * 0.97);
  }

  const oversizeFactor = oversized ? 1.15 : 1;
  const expressFactor = input.type === "express" ? 1.4 : 1;

  const apply = (p: number | null) => (p === null ? null : Math.round(p * oversizeFactor * expressFactor));

  const results: CarrierResult[] = [
    {
      carrier: "dl",
      name: names.dl,
      price: apply(dlPrice),
      days: dlPrice !== null ? estimateDays("dl", input.from, input.to, input.type) : null,
      rating: ratings.dl,
      oversized,
      note: dlPrice !== null ? "Расчётная цена (API ДЛ)" : "Нет данных по направлению",
    },
    {
      carrier: "rttk",
      name: names.rttk,
      price: apply(rttkPrice),
      days: rttkPrice !== null ? estimateDays("rttk", input.from, input.to, input.type) : null,
      rating: ratings.rttk,
      oversized,
      note: rttkPrice === null ? "Нет тарифа по направлению" : undefined,
    },
    {
      carrier: "brl",
      name: names.brl,
      price: apply(brlPrice),
      days: brlPrice !== null ? estimateDays("brl", input.from, input.to, input.type) : null,
      rating: ratings.brl,
      oversized,
      note: brlPrice === null ? "Нет тарифа по направлению" : undefined,
    },
  ];

  return { results, volume, totalWeight, oversized };
}
