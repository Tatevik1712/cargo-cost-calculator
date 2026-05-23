import { useMemo, useState } from "react";
import { Truck, Package, MapPin, Calculator, Star, AlertTriangle, Plane, Award, Clock, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calculate, getAllCities, type CarrierResult } from "@/lib/calc";
import { cn } from "@/lib/utils";

const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";

export function CargoCalculator() {
  const cities = useMemo(() => getAllCities(), []);
  const [from, setFrom] = useState("Чита");
  const [to, setTo] = useState("Москва");
  const [weight, setWeight] = useState(500);
  const [length, setLength] = useState(120);
  const [width, setWidth] = useState(80);
  const [height, setHeight] = useState(80);
  const [quantity, setQuantity] = useState(1);
  const [type, setType] = useState<"auto" | "express">("auto");
  const [result, setResult] = useState<ReturnType<typeof calculate> | null>(null);

  const onCalc = () => {
    setResult(calculate({ from, to, weight, length, width, height, quantity, type }));
    setTimeout(() => {
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const bestPrice = result ? Math.min(...result.results.filter((r) => r.price !== null).map((r) => r.price!)) : null;
  const bestDays = result ? Math.min(...result.results.filter((r) => r.days !== null).map((r) => r.days!)) : null;
  const bestRating = result ? Math.max(...result.results.map((r) => r.rating)) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
              <Truck className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-semibold leading-tight">КаргоКалк</div>
              <div className="text-xs text-muted-foreground">сравнение 3 перевозчиков</div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            Тарифы актуальны
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-12 sm:py-16" style={{ background: "var(--gradient-hero)" }}>
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Калькулятор стоимости перевозки
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Один расчёт — сразу три перевозчика. Сравните цену, срок и рейтинг
            и выберите лучший вариант для вашего груза.
          </p>
        </div>
      </section>

      {/* Calculator */}
      <main className="mx-auto max-w-6xl px-6 -mt-8 pb-20">
        <div
          className="rounded-2xl bg-card border border-border p-6 sm:p-8"
          style={{ boxShadow: "var(--shadow-elegant)" }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Направление */}
            <div className="space-y-5">
              <SectionTitle icon={<MapPin className="h-4 w-4" />} title="Направление" />
              <div>
                <Label className="text-xs text-muted-foreground">Откуда</Label>
                <Select value={from} onValueChange={setFrom}>
                  <SelectTrigger className="h-11 mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Куда</Label>
                <Select value={to} onValueChange={setTo}>
                  <SelectTrigger className="h-11 mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <SectionTitle icon={<Truck className="h-4 w-4" />} title="Тип перевозки" />
              <div className="grid grid-cols-2 gap-3">
                <TypeCard
                  active={type === "auto"}
                  onClick={() => setType("auto")}
                  icon={<Truck className="h-5 w-5" />}
                  title="Авто"
                  sub="Стандартно"
                />
                <TypeCard
                  active={type === "express"}
                  onClick={() => setType("express")}
                  icon={<Plane className="h-5 w-5" />}
                  title="Экспресс"
                  sub="Быстрее, дороже"
                />
              </div>
            </div>

            {/* Груз */}
            <div className="space-y-5">
              <SectionTitle icon={<Package className="h-4 w-4" />} title="Параметры груза" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Вес, кг" value={weight} onChange={setWeight} />
                <Field label="Количество мест" value={quantity} onChange={setQuantity} min={1} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Габариты одного места, см</Label>
                <div className="grid grid-cols-3 gap-3 mt-1.5">
                  <Field label="Длина" value={length} onChange={setLength} compact />
                  <Field label="Ширина" value={width} onChange={setWidth} compact />
                  <Field label="Высота" value={height} onChange={setHeight} compact />
                </div>
              </div>

              <div className="rounded-xl bg-muted/60 px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Общий объём</span>
                <span className="font-semibold tabular-nums">
                  {((length * width * height * quantity) / 1_000_000).toFixed(2)} м³
                </span>
              </div>
              <div className="rounded-xl bg-muted/60 px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Общий вес</span>
                <span className="font-semibold tabular-nums">
                  {(weight * quantity).toLocaleString("ru-RU")} кг
                </span>
              </div>
            </div>
          </div>

          <Button onClick={onCalc} size="lg" className="w-full mt-8 h-12 text-base" style={{ background: "var(--gradient-primary)" }}>
            <Calculator className="h-5 w-5 mr-2" />
            Рассчитать стоимость
          </Button>
        </div>

        {/* Results */}
        {result && (
          <div id="results" className="mt-12 space-y-6 scroll-mt-24">
            {result.oversized && (
              <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium">Негабаритный груз</div>
                  <div className="text-muted-foreground">
                    Размер места &gt; 2 м или вес &gt; 1500 кг. Применён коэффициент +15%.
                  </div>
                </div>
              </div>
            )}

            <div>
              <h2 className="text-2xl font-bold">Сравнение перевозчиков</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Зелёным отмечен лучший показатель по каждому критерию
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {result.results.map((r) => (
                <CarrierCard
                  key={r.carrier}
                  r={r}
                  bestPrice={bestPrice}
                  bestDays={bestDays}
                  bestRating={bestRating}
                />
              ))}
            </div>

            <Advice results={result.results} />
          </div>
        )}
      </main>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80 uppercase tracking-wide">
      <span className="text-primary">{icon}</span>
      {title}
    </div>
  );
}

function Field({
  label, value, onChange, min = 0, compact = false,
}: {
  label: string; value: number; onChange: (n: number) => void; min?: number; compact?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        className={cn("mt-1.5", compact ? "h-10" : "h-11")}
      />
    </div>
  );
}

function TypeCard({
  active, onClick, icon, title, sub,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-4 py-3 text-left transition-all",
        active
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border hover:border-primary/40 hover:bg-muted/40",
      )}
    >
      <div className={cn("flex items-center gap-2 font-medium", active && "text-primary")}>
        {icon}
        {title}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </button>
  );
}

const CARRIER_COLORS: Record<string, string> = {
  dl: "from-blue-500 to-blue-700",
  rttk: "from-amber-500 to-orange-600",
  brl: "from-emerald-500 to-teal-600",
};

function CarrierCard({
  r, bestPrice, bestDays, bestRating,
}: { r: CarrierResult; bestPrice: number | null; bestDays: number | null; bestRating: number | null }) {
  const unavailable = r.price === null;
  const isBestPrice = r.price !== null && r.price === bestPrice;
  const isBestDays = r.days !== null && r.days === bestDays;
  const isBestRating = r.rating === bestRating;

  return (
    <div
      className={cn(
        "rounded-2xl bg-card border p-6 relative transition-all",
        isBestPrice ? "border-success/50" : "border-border",
      )}
      style={{ boxShadow: isBestPrice ? "var(--shadow-elegant)" : "var(--shadow-card)" }}
    >
      {isBestPrice && (
        <div className="absolute -top-3 left-6 px-2.5 py-1 rounded-full bg-success text-white text-xs font-medium flex items-center gap-1">
          <Award className="h-3 w-3" /> Лучшая цена
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className={cn("h-10 w-10 rounded-lg bg-gradient-to-br flex items-center justify-center text-white", CARRIER_COLORS[r.carrier])}>
          <Truck className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold">{r.name}</div>
          <div className={cn("flex items-center gap-1 text-xs", isBestRating ? "text-success font-medium" : "text-muted-foreground")}>
            <Star className={cn("h-3 w-3", isBestRating ? "fill-success" : "fill-muted-foreground")} />
            {r.rating.toFixed(1)} / 5.0
          </div>
        </div>
      </div>

      <div className="mt-6">
        {unavailable ? (
          <div className="text-muted-foreground text-sm py-4">
            {r.note ?? "Нет данных"}
          </div>
        ) : (
          <>
            <div className={cn("text-3xl font-bold tabular-nums", isBestPrice && "text-success")}>
              {fmt(r.price!)}
            </div>
            {r.note && <div className="text-xs text-muted-foreground mt-1">{r.note}</div>}

            <div className="mt-5 pt-5 border-t border-border space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" /> Срок доставки
                </span>
                <span className={cn("font-semibold tabular-nums", isBestDays && "text-success")}>
                  {r.days} {r.days === 1 ? "день" : r.days! < 5 ? "дня" : "дней"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Wallet className="h-4 w-4" /> Тариф
                </span>
                <span className="font-medium">{r.carrier === "dl" ? "Авто, дверь-дверь" : "Авто, склад-склад"}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Advice({ results }: { results: CarrierResult[] }) {
  const valid = results.filter((r) => r.price !== null);
  if (valid.length < 2) return null;
  const cheapest = valid.reduce((a, b) => (a.price! < b.price! ? a : b));
  const fastest = valid.reduce((a, b) => (a.days! < b.days! ? a : b));
  return (
    <div className="rounded-2xl bg-primary/5 border border-primary/20 p-6">
      <div className="font-semibold mb-2">Рекомендация</div>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{cheapest.name}</span> — самый
        дешёвый вариант ({fmt(cheapest.price!)}).{" "}
        {cheapest.carrier !== fastest.carrier && (
          <>
            Если важна скорость — выберите{" "}
            <span className="font-medium text-foreground">{fastest.name}</span> ({fastest.days} дн.).
          </>
        )}
      </p>
    </div>
  );
}