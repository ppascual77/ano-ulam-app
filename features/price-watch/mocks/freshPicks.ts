// Mock only — no DA price-monitoring API wired up yet. One pick per
// category, the biggest week-over-week price drop in that category.
export type FreshPick = {
  id: string;
  name: string;
  category: string;
  price: number;
  previousPrice: number;
  percentCheaper: number;
  /** [from, to] gradient stops, in scroll order. */
  gradient: [string, string];
};

export const freshPicks: FreshPick[] = [
  {
    id: "pomelo",
    name: "Pomelo",
    category: "Fruits",
    price: 174.08,
    previousPrice: 176.15,
    percentCheaper: 1.2,
    gradient: ["#065F46", "#052e16"], // emerald-800 -> green-950
  },
  {
    id: "whole-chicken",
    name: "Whole Chicken",
    category: "Meat",
    price: 199.76,
    previousPrice: 209.85,
    percentCheaper: 4.8,
    gradient: ["#0f766e", "#064e3b"], // teal-700 -> emerald-900
  },
  {
    id: "malunggay",
    name: "Malunggay",
    category: "Vegetables",
    price: 42.5,
    previousPrice: 45.0,
    percentCheaper: 5.6,
    gradient: ["#15803d", "#134e4a"], // green-700 -> teal-900
  },
  {
    id: "galunggong",
    name: "Galunggong",
    category: "Fish",
    price: 220.3,
    previousPrice: 224.1,
    percentCheaper: 1.7,
    gradient: ["#065F46", "#052e16"], // emerald-800 -> green-950
  },
];
