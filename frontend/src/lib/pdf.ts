import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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

// Транслитерация для корректной печати кириллицы стандартными шрифтами jsPDF
function translit(s: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
    и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
    с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  return s
    .split("")
    .map((c) => {
      const lower = c.toLowerCase();
      const t = map[lower];
      if (t === undefined) return c;
      return c === lower ? t : t.charAt(0).toUpperCase() + t.slice(1);
    })
    .join("");
}

const T = translit;

export function generateReport(data: ReportData) {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(T("Отчёт по расчёту перевозки"), W / 2, y, { align: "center" });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  const now = new Date().toLocaleString("ru-RU");
  doc.text(T(`Дата: ${now}`), W / 2, y, { align: "center" });
  if (data.username) {
    y += 5;
    doc.text(T(`Пользователь: ${data.username}`), W / 2, y, { align: "center" });
  }
  doc.setTextColor(0);
  y += 10;

  // Маршрут
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(T("Маршрут"), 14, y);
  y += 2;
  autoTable(doc, {
    startY: y + 2,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 10 },
    body: [
      [T("Откуда"), T(data.from)],
      [T("Куда"), T(data.to)],
      [T("Тип перевозки"), T(data.type === "express" ? "Экспресс" : "Авто")],
    ],
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 55, fillColor: [245, 245, 245] } },
  });
  // @ts-ignore
  y = doc.lastAutoTable.finalY + 8;

  // Параметры груза
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(T("Параметры груза"), 14, y);
  autoTable(doc, {
    startY: y + 4,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 10 },
    body: [
      [T("Вес одного места"), `${data.weight} ${T("кг")}`],
      [T("Количество мест"), `${data.quantity} ${T("шт")}`],
      [T("Габариты (ДxШxВ)"), `${data.length} x ${data.width} x ${data.height} ${T("см")}`],
      [T("Общий объём"), `${data.totalVolume.toFixed(3)} m3`],
      [T("Общий вес"), `${data.totalWeight.toLocaleString("ru-RU")} ${T("кг")}`],
    ],
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 55, fillColor: [245, 245, 245] } },
  });
  // @ts-ignore
  y = doc.lastAutoTable.finalY + 8;

  // Предложения
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(T("Предложения перевозчиков"), 14, y);

  const sorted = [...data.offers].sort((a, b) => {
    const ap = a.price && a.price > 0 ? a.price : Infinity;
    const bp = b.price && b.price > 0 ? b.price : Infinity;
    return ap - bp;
  });

  autoTable(doc, {
    startY: y + 4,
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235], textColor: 255, font: "helvetica", fontStyle: "bold" },
    styles: { font: "helvetica", fontSize: 10 },
    head: [[T("№"), T("Компания"), T("Цена"), T("Срок"), T("Описание")]],
    body: sorted.map((o, i) => {
      const isUn = !o.price || o.price === 0 || o.status === "unavailable";
      return [
        String(i + 1),
        T(o.company),
        isUn ? T("недоступно") : fmt(o.price),
        isUn ? "—" : T(String(o.term)),
        T(o.description || o.error_message || ""),
      ];
    }),
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      2: { halign: "right", fontStyle: "bold" },
    },
  });
  // @ts-ignore
  y = doc.lastAutoTable.finalY + 8;

  // Рекомендация
  if (data.recommendation) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(T("Рекомендация"), 14, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(T(data.recommendation), W - 28);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 4;
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      T(`Cargo Calculator • стр. ${i} из ${pageCount}`),
      W / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" },
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`cargo-report-${stamp}.pdf`);
}