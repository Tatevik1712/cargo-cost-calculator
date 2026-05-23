import { createFileRoute } from "@tanstack/react-router";
import { CargoCalculator } from "@/components/CargoCalculator";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Калькулятор грузоперевозок — сравните 3 ТК за 1 клик" },
      { name: "description", content: "Рассчитайте стоимость и срок доставки груза через Деловые Линии, РТТК и БРЛ. Сравните цены, сроки и рейтинг перевозчиков." },
    ],
  }),
});

function Index() {
  return <CargoCalculator />;
}
