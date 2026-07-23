import { jsPDF } from "jspdf";

const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(n) + " RUB";

interface Offer {
  company: string;
  price: number;
  term: string;
  description?: string;
  oversized?: boolean;
  status?: string;
  error_message?: string;
}

interface ReportData {
  from: string;
  to: string;
  type: string;
  weight: number;
  length: number;
  width: number;
  height: number;
  quantity: number;
  totalVolume: number;
  totalWeight: number;
  offers: Offer[];
  recommendation?: string | null;
  username?: string;
}

export function generateReport(data: ReportData) {
  console.log("=== ЗАПУСК ГЕНЕРАЦИИ ЧЕРЕЗ КАНВАС ===");

  try {
    // 1. Создаем скрытый виртуальный холст с хорошим разрешением (PPI)
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Не удалось создать контекст Canvas");

    const width = 1200;
    // Динамически рассчитываем высоту холста в зависимости от количества предложений
    const offersCount = data.offers?.length || 0;
    const height = 1400 + offersCount * 100 + (data.recommendation ? 200 : 0);

    canvas.width = width;
    canvas.height = height;

    // Заливаем фон белым цветом
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Устанавливаем стандартный системный шрифт, который гарантированно есть везде и поддерживает кириллицу
    const systemFont = "Arial, Helvetica, sans-serif";
    let y = 80;

    // 2. Отрисовка Шапки
    ctx.fillStyle = "#1e293b";
    ctx.font = `bold 36px ${systemFont}`;
    ctx.textAlign = "center";
    ctx.fillText("Отчёт по расчёту перевозки", width / 2, y);
    y += 50;

    ctx.fillStyle = "#64748b";
    ctx.font = `20px ${systemFont}`;
    const now = new Date().toLocaleString("ru-RU");
    ctx.fillText(`Дата создания: ${now}`, width / 2, y);

    if (data.username) {
      y += 35;
      ctx.fillText(`Пользователь: ${data.username}`, width / 2, y);
    }
    y += 70;

    // Функция для отрисовки стандартных двухколоночных таблиц параметров
    const drawInfoTable = (title: string, rows: [string, string][]) => {
      ctx.textAlign = "left";
      ctx.fillStyle = "#0f172a";
      ctx.font = `bold 24px ${systemFont}`;
      ctx.fillText(title, 80, y);
      y += 20;

      rows.forEach(([label, value]) => {
        // Задний фон строки
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(80, y, width - 160, 45);

        // Граница строки
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.strokeRect(80, y, width - 160, 45);

        // Текст левой колонки
        ctx.fillStyle = "#475569";
        ctx.font = `bold 18px ${systemFont}`;
        ctx.fillText(label, 100, y + 28);

        // Текст правой колонки
        ctx.fillStyle = "#0f172a";
        ctx.font = `18px ${systemFont}`;
        ctx.fillText(value, 350, y + 28);
        y += 45;
      });
      y += 40;
    };

    // 3. Таблица Маршрута
    drawInfoTable("Маршрут перевозки", [
      ["Откуда", data.from || "—"],
      ["Куда", data.to || "—"],
      ["Тип перевозки", data.type]
    ]);

    // 4. Таблица Параметров груза
    drawInfoTable("Характеристики груза", [
      ["Вес одного места", `${data.weight ?? 0} кг`],
      ["Количество мест", `${data.quantity ?? 0} шт`],
      ["Габариты (ДxШxВ)", `${data.length ?? 0} x ${data.width ?? 0} x ${data.height ?? 0} см`],
      ["Общий объём", `${(data.totalVolume ?? 0).toFixed(3)} м³`],
      ["Общий вес", `${(data.totalWeight ?? 0).toLocaleString("ru-RU")} кг`]
    ]);

    // 5. Таблица Предложений перевозчиков
    ctx.textAlign = "left";
    ctx.fillStyle = "#0f172a";
    ctx.font = `bold 24px ${systemFont}`;
    ctx.fillText("Предложения перевозчиков", 80, y);
    y += 25;

    // Шапка таблицы предложений
    ctx.fillStyle = "#2563eb"; // Синий цвет
    ctx.fillRect(80, y, width - 160, 50);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 18px ${systemFont}`;
    ctx.fillText("№", 100, y + 32);
    ctx.fillText("Компания", 150, y + 32);
    ctx.fillText("Цена", 450, y + 32);
    ctx.fillText("Срок", 650, y + 32);
    ctx.fillText("Описание", 800, y + 32);
    y += 50;

    // Строки предложений
    const sortedOffers = [...(data.offers || [])].sort((a, b) => {
      const ap = a.price && a.price > 0 ? a.price : Infinity;
      const bp = b.price && b.price > 0 ? b.price : Infinity;
      return ap - bp;
    });

    sortedOffers.forEach((o, i) => {
      ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#f8fafc";
      ctx.fillRect(80, y, width - 160, 50);

      ctx.strokeStyle = "#e2e8f0";
      ctx.strokeRect(80, y, width - 160, 50);

      ctx.fillStyle = "#0f172a";
      ctx.font = `18px ${systemFont}`;

      const isUn = !o.price || o.price === 0 || o.status === "unavailable";

      ctx.fillText(String(i + 1), 100, y + 32);
      ctx.fillText(o.company || "—", 150, y + 32);
      ctx.fillText(isUn ? "недоступно" : fmt(o.price), 450, y + 32);
      ctx.fillText(isUn ? "—" : String(o.term || "—"), 650, y + 32);

      // Обрезка слишком длинного описания для предотвращения выезда за границы холста
      const desc = o.description || o.error_message || "";
      const shortDesc = desc.length > 35 ? desc.substring(0, 32) + "..." : desc;
      ctx.fillText(shortDesc, 800, y + 32);

      y += 50;
    });
    y += 40;

    // Футер снизу картинки
    ctx.fillStyle = "#94a3b8";
    ctx.font = `14px ${systemFont}`;
    ctx.textAlign = "center";
    ctx.fillText("Cargo Calculator • Сгенерировано автоматически", width / 2, height - 30);

    // 7. Конвертируем холст в изображение и сохраняем через чистый jsPDF без использования его текстового движка
    const imgData = canvas.toDataURL("image/jpeg", 1.0);

    // Создаем PDF-документ с размерами холста
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: [width, height]
    });

    pdf.addImage(imgData, "JPEG", 0, 0, width, height);

    const stamp = new Date().toISOString().slice(0, 10);
    pdf.save(`cargo-report-${stamp}.pdf`);
    console.log("=== УСПЕХ: PDF СГЕНЕРИРОВАН И СКАЧАН ===");

  } catch (err) {
    console.error("!!! ОШИБКА КАНВАС-ГЕНЕРАЦИИ !!!", err);
  }
}