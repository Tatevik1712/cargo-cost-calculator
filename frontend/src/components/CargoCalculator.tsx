import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Truck, Package, MapPin, Calculator, AlertTriangle, Award, Clock, Wallet, CheckCircle2, FileDown, LogOut, ShieldAlert, LogIn, User } from "lucide-react";
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
import { calculate, getCitiesFromBackend, type CarrierResult } from "@/lib/calc";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/lib/auth";
import { generateReport } from "@/lib/pdf";
import { API_BASE_URL } from "@/config";

const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";

const LIMITS = {
    weight: { min: 1, max: 20000, label: "кг" },
    dim: { min: 1, max: 240, label: "см" },
    qty: { min: 1, max: 999, label: "шт" },
};

type NumField = "weight" | "length" | "width" | "height" | "quantity";

export function CargoCalculator() {
    const user = useAuth();
    const navigate = useNavigate();

    // Тип перевозки — теперь только "авто"
    const type = "auto" as const;

    const [backendResult, setBackendResult] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // --- Города: без статики, с явным состоянием загрузки/ошибки ---
    const [cities, setCities] = useState<string[]>([]);
    const [citiesLoading, setCitiesLoading] = useState(true);
    const [citiesError, setCitiesError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        getCitiesFromBackend()
            .then((list) => {
                if (mounted) setCities(list);
            })
            .catch((err) => {
                console.error("Ошибка загрузки городов:", err);
                if (mounted) setCitiesError(err instanceof Error ? err.message : String(err));
            })
            .finally(() => {
                if (mounted) setCitiesLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, []);

    const [from, setFrom] = useState("Чита");
    const [to, setTo] = useState("Москва");

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
        setBackendResult(null);

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
            const response = await fetch(`${API_BASE_URL}/api/v1/calculate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "ngrok-skip-browser-warning": "true",
                },
                body: JSON.stringify(requestData),
            });

            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.status}`);
            }

            const data = await response.json();
            setBackendResult(data);

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

    const isAvailable = (o: any) =>
        o && typeof o.price === "number" && o.price > 0;

    const sortedResults = useMemo(() => {
        if (!backendResult || !Array.isArray(backendResult.offers)) return [];
        const offers = [...backendResult.offers];
        return offers.sort((a: any, b: any) => {
            const aOk = isAvailable(a);
            const bOk = isAvailable(b);
            if (aOk && !bOk) return -1;
            if (!aOk && bOk) return 1;
            if (aOk && bOk) return a.price - b.price;
            return String(a.company || "").localeCompare(String(b.company || ""), "ru");
        });
    }, [backendResult]);

    const availableCount = useMemo(
        () => sortedResults.filter(isAvailable).length,
        [sortedResults],
    );

    const offersWord = (n: number) => {
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod100 >= 11 && mod100 <= 14) return "предложений";
        if (mod10 === 1) return "предложение";
        if (mod10 >= 2 && mod10 <= 4) return "предложения";
        return "предложений";
    };

    const bestPrice = useMemo(() => {
        const first = sortedResults.find(isAvailable);
        return first ? first.price : null;
    }, [sortedResults]);

    const isOversized = sortedResults.some((o: any) => o.oversized);

    const clientRecommendation = useMemo(() => {
        if (!backendResult || !backendResult.offers) return null;

        const validOffers = backendResult.offers.filter(
            (o: any) => o.price && o.price > 0
        );

        if (validOffers.length === 0) {
            return "К сожалению, ни одна из логистических компаний не обслуживает данный маршрут для выбранных параметров груза.";
        }

        const cheapest = validOffers.reduce((prev: any, current: any) => (prev.price < current.price ? prev : current));

        if (validOffers.length === 1) {
            return `Для данного направления доступен один вариант: ТК "${cheapest.company}" с тарифом ${fmt(cheapest.price)}.`;
        }

        const alternative = validOffers.find((o: any) => o.company !== cheapest.company);
        const alternativeText = alternative ? ` Для сравнения, альтернативный доступный рейс предоставляет ТК "${alternative.company}" (${fmt(alternative.price)}).` : "";

        return `Самый бюджетный вариант предоставляет  "${cheapest.company}" (${fmt(cheapest.price)}).${alternativeText} Перед отправкой убедитесь в правильности габаритов мест.`;
    }, [backendResult]);

    const totalVol = ((values.length * values.width * values.height) / 1000000) * values.quantity;
    const totalWeight = values.weight * values.quantity;

    return (
        <div className="min-h-screen bg-background">
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
                    <div className="flex items-center gap-2">
                        {user ? (
                            <>
                                {user.role === "admin" && (
                                    <Link to="/admin">
                                        <Button variant="outline" size="sm" className="gap-1.5">
                                            <ShieldAlert className="h-4 w-4" /> Админ
                                        </Button>
                                    </Link>
                                )}
                                <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground px-2">
                                    <User className="h-4 w-4" />
                                    {user.name}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { logout(); navigate({ to: "/login" }); }}
                                    className="gap-1.5"
                                >
                                    <LogOut className="h-4 w-4" /> Выйти
                                </Button>
                            </>
                        ) : (
                            <Link to="/login">
                                <Button size="sm" className="gap-1.5">
                                    <LogIn className="h-4 w-4" /> Войти
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>
            </header>

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

            <main className="mx-auto max-w-5xl px-6 -mt-12 pb-20">
                <div
                    className="rounded-3xl bg-card border border-border p-6 sm:p-8"
                    style={{ boxShadow: "var(--shadow-card)" }}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
                        {/* Направление */}
                        <div className="space-y-4">
                            <SectionTitle icon={<MapPin className="h-4 w-4" />} title="Направление" />

                            {/* --- Состояние загрузки/ошибки городов --- */}
                            {citiesLoading && (
                                <p className="text-sm text-muted-foreground">Загрузка списка городов...</p>
                            )}
                            {citiesError && (
                                <p className="text-sm text-destructive">
                                    Не удалось загрузить города: {citiesError}
                                </p>
                            )}

                            <div>
                                <Label className="text-xs font-medium text-muted-foreground">Откуда</Label>
                                <Select value={from} onValueChange={setFrom} disabled={citiesLoading || !!citiesError}>
                                    <SelectTrigger className="h-11 mt-1.5"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs font-medium text-muted-foreground">Куда</Label>
                                <Select value={to} onValueChange={setTo} disabled={citiesLoading || !!citiesError}>
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
                            {/* Карточка на всю ширину колонки */}
                            <div className="w-full">
                                <div
                                    className="rounded-xl border-2 border-primary bg-primary/5 p-4 cursor-default transition-all w-full"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                                            <Truck className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-primary">Авто</div>
                                            <div className="text-xs text-muted-foreground">Стандартно</div>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-xs text-primary">
                                        ✓ Выбранный тип
                                    </div>
                                </div>
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
                                <h2 className="text-2xl font-semibold">Найдено {availableCount} {offersWord(availableCount)}</h2>
                            </div>
                            <div className="flex items-center gap-3">
                                {bestPrice !== null && (
                                    <div className="flex items-center gap-1.5 text-sm text-success font-medium">
                                        <CheckCircle2 className="h-4 w-4" />
                                        От {fmt(bestPrice)}
                                    </div>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => generateReport({
                                        from, to, type,
                                        weight: values.weight,
                                        length: values.length,
                                        width: values.width,
                                        height: values.height,
                                        quantity: values.quantity,
                                        totalVolume: totalVol,
                                        totalWeight: totalWeight,
                                        offers: backendResult?.offers || [],
                                        recommendation: clientRecommendation,
                                        username: user?.name,
                                    })}
                                    className="gap-1.5"
                                >
                                    <FileDown className="h-4 w-4" /> Скачать PDF
                                </Button>
                            </div>
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