import { useMemo, useState } from "react";
import { Truck, Package, MapPin, Calculator, AlertTriangle, Plane, Award, Clock, Wallet, CheckCircle2 } from "lucide-react";
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

// Validation limits
const LIMITS = {
    weight: { min: 1, max: 20000, label: "кг" },
    dim: { min: 1, max: 240, label: "см" }, // standard truck max ~240cm
    qty: { min: 1, max: 999, label: "шт" },
};

type NumField = "weight" | "length" | "width" | "height" | "quantity";

export function CargoCalculator() {
    // 1. Оставляем один стейт для типа перевозки
    const [type, setType] = useState<"auto" | "express">("auto");

    // 2. Стейты для работы с FastAPI-бэкендом
    const [backendResult, setBackendResult] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // 3. Старый результат (если он пока нужен для совместимости, оставляем только этот один)
    const [result, setResult] = useState<ReturnType<typeof calculate> | null>(null);

    // 4. Стейты формы и городов
    const cities = useMemo(() => getAllCities(), []);
    const [from, setFrom] = useState("Чита");
    const [to, setTo] = useState("Москва");

    // Параметры груза
    const [weight, setWeight] = useState("500");
    const [length, setLength] = useState("120");
    const [width, setWidth] = useState("80");
    const [height, setHeight] = useState("80");
    const [quantity, setQuantity] = useState("1");

    const num = (s: string) => (s === "" ? NaN : Number(s));
    const values = {
        weight: num(weight),
        length: num(length),
        width: num(width),
        height: num(height),
        quantity: num(quantity),
    };

    const errors: Partial<Record<NumField, string>> = {};
    const check = (k: NumField, v: number, lim: { min: number; max: number; label: string }) => {
        if (Number.isNaN(v)) errors[k] = "Укажите значение";
        else if (v < lim.min) errors[k] = `Мин. ${lim.min} ${lim.label}`;
        else if (v > lim.max) errors[k] = `Макс. ${lim.max} ${lim.label}`;
    };
    check("weight", values.weight, LIMITS.weight);
    check("length", values.length, LIMITS.dim);
    check("width", values.width, LIMITS.dim);
    check("height", values.height, LIMITS.dim);
    check("quantity", values.quantity, LIMITS.qty);

    const routeError = from === to ? "Города отправления и назначения совпадают" : null;
    const isValid = Object.keys(errors).length === 0 && !routeError;

    const onCalc = async () => {
        if (!isValid) return;

        setIsLoading(true);
        setBackendResult(null); // Очищаем прошлый результат перед новым запросом

        // Формируем JSON-пакет по схеме Pydantic, которую ждет наш FastAPI
        const requestData = {
            from_location: from,
            to_location: to,
            length: values.length,
            width: values.width,
            height: values.height,
            weight: values.weight,
            quantity: values.quantity,
            delivery_type: type,
        };

        try {
            const response = await fetch("http://127.0.0.1:8000/api/v1/calculate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                body: JSON.stringify(requestData),
            });

            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.status}`);
            }

            const data = await response.json();

            // Сохраняем ответ бэкенда в наше новое состояние
            setBackendResult(data);

            // Плавно скроллим к результатам
            setTimeout(() => {
                document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 50);

        } catch (error) {
            console.error("Ошибка при запросе к бэкенду:", error);
            alert("Не удалось связаться с сервером расчетов. Проверьте, что бэкенд запущен.");
        } finally {
            setIsLoading(false);
        }
    };

// Сортировка предложений от бэкенда
// todo: доделать логику сортировки в фронтенде
    const sortedResults = useMemo(() => {
        if (!backendResult || !backendResult.offers) return [];
        return [...backendResult.offers];
    }, [backendResult]);

    // ИСПРАВЛЕНО: Считаем только РЕАЛЬНО доступные предложения с ценой
    const availableCount = useMemo(() => {
        if (!backendResult || !backendResult.offers) return 0;
        return backendResult.offers.filter(
            (o: any) => o.status === "available" && o.price && o.price > 0
        ).length;
    }, [backendResult]);

    // Ищем лучшую цену исключительно среди ТЕХ компаний, которые РЕАЛЬНО везут груз (цена > 0)
    const bestPrice = useMemo(() => {
        const validOffers = sortedResults.filter((o: any) => o.price && o.price > 0 && o.status === "available");
        if (validOffers.length === 0) return null;
        return Math.min(...validOffers.map((o: any) => o.price));
    }, [sortedResults]);

    // Проверка на негабарит (смотрим, есть ли флаг oversized хотя бы у одной компании)
    const isOversized = sortedResults.some((o: any) => o.oversized);

    // Вычисляем чистую и красивую рекомендацию на фронтенде
    const clientRecommendation = useMemo(() => {
        if (!backendResult || !backendResult.offers) return null;

        // Фильтруем только те компании, у которых статус "доступен" и цена корректная
        const validOffers = backendResult.offers.filter(
            (o: any) => o.status === "available" && o.price && o.price > 0
        );

        if (validOffers.length === 0) {
            return "К сожалению, ни одна из логистических компаний не обслуживает данный маршрут для выбранных параметров груза.";
        }

        // Находим самое бюджетное предложение среди валидных
        const cheapest = validOffers.reduce((prev: any, current: any) => (prev.price < current.price ? prev : current));

        if (validOffers.length === 1) {
            return `Для данного направления доступен один вариант: ТК "${cheapest.company}" с тарифом ${fmt(cheapest.price)}.`;
        }

        // Если доступно несколько вариантов
        const alternative = validOffers.find((o: any) => o.company !== cheapest.company);
        const alternativeText = alternative ? ` Для сравнения, альтернативный доступный рейс предоставляет ТК "${alternative.company}" (${fmt(alternative.price)}).` : "";

        return `Самый бюджетный вариант предоставляет  "${cheapest.company}" (${fmt(cheapest.price)}).${alternativeText} Перед отправкой убедитесь в правильности габаритов мест.`;
    }, [backendResult]);

    const totalVol = ((values.length * values.width * values.height) / 1000000) * values.quantity;
    const totalWeight = values.weight * values.quantity;

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border/40 bg-card/80 backdrop-blur-md sticky top-0 z-10">
                <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-primary">
                            <Truck className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                            <div className="font-semibold leading-tight">CargoCalculator</div>
                            <div className="text-xs text-muted-foreground">Калькулятор перевозок</div>
                        </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                        Автор: Саргсян Татев. Для ПАО «ГМК „Норильский никель“»
                    </div>
                </div>
            </header>

            {/* Hero */}
            <section className="px-6 pt-12 pb-20 sm:pt-16 sm:pb-24">
                <div className="mx-auto max-w-2xl text-center">
                    <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                        Тестовое веб-приложение для подсчета перевозки груза
                    </h1>
                    <p className="mt-3 text-base text-muted-foreground">
                        Заполните параметры — покажем цены трёх перевозчиков сразу.
                    </p>
                </div>
            </section>

            {/* Calculator */}
            <main className="mx-auto max-w-5xl px-6 -mt-12 pb-20">
                <div
                    className="rounded-3xl bg-card border border-border p-6 sm:p-8"
                    style={{ boxShadow: "var(--shadow-card)" }}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
                        {/* Направление */}
                        <div className="space-y-4">
                            <SectionTitle icon={<MapPin className="h-4 w-4" />} title="Направление" />
                            <div>
                                <Label className="text-xs font-medium text-muted-foreground">Откуда</Label>
                                <Select value={from} onValueChange={setFrom}>
                                    <SelectTrigger className="h-11 mt-1.5"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs font-medium text-muted-foreground">Куда</Label>
                                <Select value={to} onValueChange={setTo}>
                                    <SelectTrigger className="h-11 mt-1.5"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {routeError && (
                                    <p className="text-xs text-destructive mt-1.5">{routeError}</p>
                                )}
                            </div>

                            <div className="pt-2">
                                <SectionTitle icon={<Truck className="h-4 w-4" />} title="Тип перевозки" />
                            </div>
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
                        <div className="space-y-4">
                            <SectionTitle icon={<Package className="h-4 w-4" />} title="Параметры груза" />
                            <div className="grid grid-cols-2 gap-3">
                                <Field
                                    label="Вес одного места"
                                    unit="кг"
                                    value={weight}
                                    onChange={setWeight}
                                    error={errors.weight}
                                />
                                <Field
                                    label="Количество мест"
                                    unit="шт"
                                    value={quantity}
                                    onChange={setQuantity}
                                    error={errors.quantity}
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-medium text-muted-foreground">
                                    Габариты одного места
                                </Label>
                                <div className="grid grid-cols-3 gap-3 mt-1.5">
                                    <Field label="Длина" unit="см" value={length} onChange={setLength} compact error={errors.length} />
                                    <Field label="Ширина" unit="см" value={width} onChange={setWidth} compact error={errors.width} />
                                    <Field label="Высота" unit="см" value={height} onChange={setHeight} compact error={errors.height} />
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Максимум 240 см по каждой стороне
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-1">
                                <Summary label="Объём" value={`${totalVol.toFixed(2)} м³`} />
                                <Summary label="Вес" value={`${totalWeight.toLocaleString("ru-RU")} кг`} />
                            </div>
                        </div>
                    </div>

                    <Button
                        onClick={onCalc}
                        disabled={!isValid || isLoading}
                        size="lg"
                        className="w-full mt-8 h-12 text-base"
                    >
                        <Calculator className="h-5 w-5 mr-2" />
                        {isLoading ? "Выполняется расчет..." : isValid ? "Рассчитать стоимость" : "Заполните данные"}
                    </Button>
                </div>

                {/* Results */}
                {backendResult && (
                    <div id="results" className="mt-12 space-y-6 scroll-mt-24">
                        {isOversized && (
                            <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                                <div className="text-sm">
                                    <div className="font-medium">Негабаритный груз</div>
                                    <div className="text-muted-foreground">
                                        Внимание! Параметры груза превышают стандартные лимиты.
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex items-end justify-between flex-wrap gap-3">
                            <div>
                                <h2 className="text-2xl font-semibold">Найдено предложений: {availableCount}</h2>
                            </div>
                            {bestPrice !== null && (
                                <div className="flex items-center gap-1.5 text-sm text-success font-medium">
                                    <CheckCircle2 className="h-4 w-4" />
                                    От {fmt(bestPrice)}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {sortedResults.map((r: any) => {
                                const isUnavailable = r.status === "unavailable" || !r.price || r.price === 0;
                                return (
                                    <div
                                        key={r.company}
                                        className="rounded-2xl bg-card border p-6 relative transition-all border-border"
                                        style={{ boxShadow: "var(--shadow-card)" }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white">
                                                <Truck className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <div className="font-semibold">{r.company}</div>
                                            </div>
                                        </div>

                                        <div className="mt-6">
                                            {isUnavailable ? (
                                                <div className="text-destructive text-sm font-medium py-2">
                                                    {r.error_message || "Маршрут не обслуживается"}
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="text-3xl font-bold tabular-nums text-success">
                                                        {fmt(r.price)}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-1">{r.description}</div>

                                                    <div className="mt-5 pt-5 border-t border-border space-y-3 text-sm">
                                                        <div className="flex items-center justify-between">
                                                            <span className="flex items-center gap-2 text-muted-foreground">
                                                                <Clock className="h-4 w-4" /> Срок доставки
                                                            </span>
                                                            <span className="font-semibold tabular-nums">
                                                                {r.term}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
    return (
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground/70 uppercase tracking-wider">
            <span className="text-primary">{icon}</span>
            {title}
        </div>
    );
}

function Summary({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl bg-muted/50 px-4 py-2.5">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="font-semibold tabular-nums text-sm mt-0.5">{value}</div>
        </div>
    );
}

function Field({
    label, value, onChange, unit, compact = false, error,
}: {
    label: string;
    value: string;
    onChange: (s: string) => void;
    unit?: string;
    compact?: boolean;
    error?: string;
}) {
    return (
        <div>
            <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
            <div className="relative mt-1.5">
                <Input
                    type="text"
                    inputMode="numeric"
                    value={value}
                    onChange={(e) => {
                        const cleaned = e.target.value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
                        onChange(cleaned);
                    }}
                    className={cn(
                        compact ? "h-10" : "h-11",
                        unit && "pr-10",
                        error && "border-destructive focus-visible:ring-destructive",
                    )}
                />
                {unit && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                        {unit}
                    </span>
                )}
            </div>
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
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