// Suggest by Budget, preferences, nutrition goals and the meal planner.
// Run: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";
import { matchBudget, parseBudget, fitsPreferences } from "@/frontend/core/budget/utils/budgetMatch";
import { generatePlan, swapOptions, dayTotals, planDates } from "@/frontend/features/meal-planner/utils/generatePlan";
import { fitsGoals } from "@/frontend/core/nutrition/goalFit";

const meal = (o) => ({ id: o.id ?? "m" + Math.random(), name: "x", price: "200", serving_size: 4, calories: 2000, protein: 100, carbs: 200, fats: 80, ingredients: [], allergens: [], dietary_tags: [], ...o });
const pm = (id, price, slots, cal = 500, pro = 25) => ({ id, name: id, price: String(price), serving_size: 1, calories: cal, protein: pro, carbs: 50, fats: 15, slots });

test("budget: ₱300 for 2 => meals costing 270..330 for 2, closest first", () => {
  const meals = [meal({ id: "a", price: "600", serving_size: 4 }), meal({ id: "b", price: "560", serving_size: 4 }), meal({ id: "c", price: "700", serving_size: 4 }), meal({ id: "d", price: "0" })];
  const r = matchBudget(meals, 300, 2, []);
  assert.deepEqual(r.map((x) => x.meal.id), ["a", "b"]);
  assert.equal(r[0].cost, 300);
});
test("budget: allergens excluded, case-insensitive", () => {
  const r = matchBudget([meal({ id: "a", price: "600", allergens: ["Shellfish"] })], 300, 2, ["shellfish"]);
  assert.equal(r.length, 0);
});
test("budget: parseBudget", () => {
  assert.equal(parseBudget("₱1,500"), 1500);
  assert.equal(parseBudget("abc"), null);
  assert.equal(parseBudget("0"), null);
  assert.equal(parseBudget("1.2.3"), null);
});
test("preferences: vegetarian accepts vegan; pescatarian accepts both", () => {
  assert.ok(fitsPreferences(meal({ dietary_tags: ["vegan"] }), { allergens: [], dietary_focus: "vegetarian" }));
  assert.ok(!fitsPreferences(meal({ dietary_tags: [] }), { allergens: [], dietary_focus: "vegetarian" }));
});

test("planner: plan stays inside budget every day, lunch != dinner", () => {
  const pool = [pm("b1", 40, ["breakfast"]), pm("b2", 60, ["breakfast"]), pm("l1", 80, ["lunch", "dinner"]), pm("l2", 90, ["lunch", "dinner"]), pm("l3", 120, ["lunch", "dinner"]), pm("d1", 100, ["dinner"])];
  const plan = generatePlan({ pool, budget: 2500, servings: 2, targets: null, from: new Date(2026, 10, 20), length: 5 });
  assert.ok(plan);
  assert.equal(plan.days.length, 5);
  for (const d of plan.days) {
    assert.ok(dayTotals(d, 2).cost <= 500 + 1e-9);
    assert.notEqual(d.meals[1].meal.id, d.meals[2].meal.id);
  }
});
test("planner: an impossible budget returns null", () => {
  const pool = [pm("b1", 100, ["breakfast"]), pm("l1", 100, ["lunch"]), pm("d1", 100, ["dinner"]), pm("d2", 120, ["dinner"])];
  assert.equal(generatePlan({ pool, budget: 100, servings: 1, targets: null }), null);
});
test("planner: a meal tagged breakfast and lunch never fills both on one day", () => {
  const pool = [pm("x", 50, ["breakfast", "lunch"]), pm("x2", 50, ["breakfast", "lunch"]), pm("d1", 50, ["dinner"])];
  const plan = generatePlan({ pool, budget: 1000, servings: 1, targets: null, length: 5 });
  assert.ok(plan);
  const dupes = plan.days.filter((d) => d.meals[0].meal.id === d.meals[1].meal.id).length;
  assert.equal(dupes, 0, `breakfast == lunch on ${dupes} of 5 days`);
});
test("planner: 7-day plan has 7 consecutive dates", () => {
  const ds = planDates(new Date(2026, 10, 28), 7);
  assert.equal(ds.length, 7);
  assert.equal(ds[6].getDate(), 4);
});
test("goals: fits within 20% calories and 85% protein of a third", () => {
  const goals = { calories: 1800, protein: 90, carbs: null, fat: null, goal: null };
  assert.ok(fitsGoals({ calories: 600, protein: 30, serving_size: 1 }, goals));
  assert.ok(!fitsGoals({ calories: 800, protein: 30, serving_size: 1 }, goals));
  assert.ok(!fitsGoals({ calories: 600, protein: 20, serving_size: 1 }, goals));
});

test("planner: swap never offers a dish already in the day", () => {
  const pool = [pm("x", 50, ["breakfast", "lunch"]), pm("y", 50, ["breakfast", "lunch"]), pm("d1", 50, ["dinner"]), pm("d2", 50, ["dinner"])];
  const plan = generatePlan({ pool, budget: 2000, servings: 1, targets: null, length: 5 });
  const day = plan.days[0];
  const lunch = day.meals[1].meal.id;
  assert.ok(!swapOptions(pool, plan, 0, "breakfast").some((m) => m.id === lunch));
});

// ---- Rice (BUG-9) -----------------------------------------------------------
test("rice: one cup from the catalog's raw rice (55 g raw, ₱/kg)", async () => {
  const { riceCupFrom } = await import("@/frontend/features/meal-planner/utils/generatePlan");
  const cup = riceCupFrom({ calories: "358.7", protein: "7", carbohydrates: "80", fat: "1", basis_amount: "100", basis_unit: "g", estimated_price: "53.92", estimated_price_unit: "kg" });
  assert.ok(Math.abs(cup.calories - 197.3) < 0.1);
  assert.ok(Math.abs(cup.carbs - 44) < 0.01);
  assert.ok(Math.abs(cup.price - 2.9656) < 0.001);
  assert.equal(riceCupFrom({ calories: 1, protein: 1, carbohydrates: 1, fat: 1, basis_amount: 100, basis_unit: "ml", estimated_price: 1, estimated_price_unit: "kg" }), null);
  assert.equal(riceCupFrom(null), null);
});

test("rice: real rice grains and noodles are the dish's own carb; rice paper, flour, wrappers aren't", async () => {
  const { isOwnCarbIngredient } = await import("@/frontend/features/meal-planner/utils/generatePlan");
  for (const name of ["White rice, cooked", "Rice, white, raw", "Glutinous rice, raw", "Brown rice, raw", "Fried rice, sinangag", "Miswa noodles, dried", "Spaghetti, dried", "Macaroni, dried", "Rice noodles, cooked"]) {
    assert.ok(isOwnCarbIngredient(name), name);
  }
  for (const name of ["White bread, sliced", "Rolled oats, raw"]) assert.ok(isOwnCarbIngredient(name), name);
  for (const name of ["rice paper", "Rice flour", "Vinegar, rice", "Lumpia wrapper", "Breadcrumbs", "Bread crumbs", "Chicken, fried (Breaded)", "Pork, belly"]) {
    assert.ok(!isOwnCarbIngredient(name), name);
  }
});

test("rice: counted with any meal, breakfast too, never with a dish that has its own carb", async () => {
  const { riceCupsFor } = await import("@/frontend/features/meal-planner/utils/generatePlan");
  const rice = { cups: 2, cup: { calories: 200, protein: 4, carbs: 44, fats: 0.5, price: 3 } };
  assert.equal(riceCupsFor("breakfast", pm("b", 50, ["breakfast"]), rice), 2);
  assert.equal(riceCupsFor("breakfast", { ...pm("s", 50, ["breakfast"]), ownCarb: true }, rice), 0);
  assert.equal(riceCupsFor("lunch", pm("l", 50, ["lunch"]), rice), 2);
  assert.equal(riceCupsFor("dinner", { ...pm("p", 50, ["dinner"]), ownCarb: true }, rice), 0);
  assert.equal(riceCupsFor("lunch", pm("l", 50, ["lunch"]), { ...rice, cups: 0 }), 0);
  assert.equal(riceCupsFor("lunch", pm("l", 50, ["lunch"]), null), 0);
});

test("rice: day totals add it per person, cost for everyone; the budget includes it", async () => {
  const { dayTotals: totals, generatePlan: gen } = await import("@/frontend/features/meal-planner/utils/generatePlan");
  const rice = { cups: 1, cup: { calories: 200, protein: 4, carbs: 44, fats: 0.5, price: 3 } };
  const day = { date: new Date(), meals: [{ slot: "breakfast", meal: pm("b", 40, ["breakfast"]) }, { slot: "lunch", meal: pm("l", 80, ["lunch"]) }, { slot: "dinner", meal: { ...pm("d", 90, ["dinner"]), ownCarb: true } }] };
  const t = totals(day, 2, rice);
  // Breakfast and lunch get a cup each; dinner has its own carb.
  assert.equal(t.calories, 1500 + 400);
  assert.equal(t.carbs, 150 + 88);
  assert.equal(t.cost, (40 + 80 + 90 + 6) * 2);
  // Without rice the same day costs ₱6 less: a budget exactly at the no-rice
  // cost can't fit the rice.
  const pool = [pm("b1", 40, ["breakfast"]), pm("l1", 80, ["lunch"]), pm("d1", 90, ["dinner"])];
  assert.ok(gen({ pool, budget: 210 * 2, servings: 2, targets: null, from: new Date(2026, 10, 20), length: 1 }));
  assert.equal(gen({ pool, budget: 210 * 2, servings: 2, targets: null, from: new Date(2026, 10, 20), length: 1, rice: { ...rice, cups: 1 } }), null);
});
