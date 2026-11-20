// Ingredient and meal price math (shared with the DA import) and DA price rules.
// Run: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";
import { convertQuantityToBasis, computeItemTotals, mealTotals, isStaleDaDate, daSetsPrice } from "@/supabase/functions/_shared/pricing";

const ing = (o) => ({ canonical_name: "pork", basis_amount: 100, basis_unit: "g", grams_per_piece: null, grams_per_ml: null, calories: 250, protein: 20, carbohydrates: 0, fat: 18, estimated_price: 320, estimated_price_unit: "kg", ...o });

test("pricing: 500 g pork at ₱320/kg = ₱160, 1250 kcal", () => {
  const t = computeItemTotals(ing({}), 500, "g");
  assert.equal(t.price, 160);
  assert.equal(t.calories, 1250);
});
test("pricing: pieces need grams_per_piece", () => {
  assert.equal(convertQuantityToBasis(2, "piece", ing({})).ok, false);
  assert.equal(computeItemTotals(ing({ grams_per_piece: 50 }), 2, "piece").price, 32);
});
test("pricing: liquid priced per L with macros per 100 g uses density", () => {
  const soy = ing({ canonical_name: "soy sauce", grams_per_ml: 1.2, estimated_price: 100, estimated_price_unit: "L" });
  assert.ok(Math.abs(computeItemTotals(soy, 60, "ml").price - 6) < 1e-9);
});
test("pricing: price override (frying oil) only changes price", () => {
  const oil = ing({ basis_unit: "ml", estimated_price: 200, estimated_price_unit: "L", grams_per_ml: 0.92 });
  const t = computeItemTotals(oil, 15, "ml", 250, "ml");
  assert.equal(t.price, 50);
  assert.equal(t.calories, 250 * 0.15);
});
test("pricing: mealTotals skips 'to taste' lines", () => {
  const t = mealTotals([{ quantity_amount: 500, quantity_unit: "g", price_quantity_amount: null, price_quantity_unit: null, ingredient: ing({}) }, { quantity_amount: null, quantity_unit: null, price_quantity_amount: null, price_quantity_unit: null, ingredient: ing({}) }]);
  assert.equal(t.price, 160);
});
test("DA: older than 7 days is stale, frozen never sets price", () => {
  const now = new Date("2026-11-20T04:00:00Z");
  assert.equal(isStaleDaDate("2026-11-10", now), true);
  assert.equal(isStaleDaDate("2026-11-18", now), false);
  assert.equal(daSetsPrice({ specification: "Frozen, imported", latest_price_date: new Date().toISOString().slice(0, 10) }), false);
});
