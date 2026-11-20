// Serving scaling: quantities, prices and macros as servings change.
// Run: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";
import { multiplyQty, formatCount } from "@/frontend/core/meals/utils/multiplyQty";
import { scaleMeal } from "@/frontend/core/meals/utils/scaleMeal";

const meal = (o) => ({ id: o.id ?? "m" + Math.random(), name: "x", price: "200", serving_size: 4, calories: 2000, protein: 100, carbs: 200, fats: 80, ingredients: [], allergens: [], dietary_tags: [], ...o });

test("multiplyQty: plain, fractions, glyphs", () => {
  assert.equal(multiplyQty("250 grams", 1.5), "375 grams");
  assert.equal(multiplyQty("1/4 cup", 0.5), "⅛ cup");
  assert.equal(multiplyQty("1 1/2 cups", 2), "3 cups");
  assert.equal(multiplyQty("½ tsp", 2), "1 tsp");
  assert.equal(multiplyQty("to taste", 3), "to taste");
});
test("multiplyQty: ranges scale at both ends", () => {
  assert.equal(multiplyQty("2-3 cloves garlic", 2), "4-6 cloves garlic");
});
test("multiplyQty: parenthesised can size is not scaled", () => {
  assert.equal(multiplyQty("1 (400g) can coconut milk", 2), "2 (400g) can coconut milk");
});
test("multiplyQty: scaling down to 1 serving keeps a readable amount", () => {
  assert.equal(multiplyQty("1 piece onion", 0.25), "¼ piece onion");
  assert.equal(multiplyQty("1 tbsp oil", 1 / 6), "0.2 tbsp oil");
});
test("formatCount pluralises generated counts", () => {
  assert.equal(formatCount(1, "clove"), "1 clove");
  assert.equal(formatCount(3, "clove"), "3 cloves");
  assert.equal(formatCount(0.5, "egg"), "½ egg");
});

test("scaleMeal: 4 -> 2 servings halves price/macros", () => {
  const s = scaleMeal(meal({ ingredients: [{ name: "pork", qty: "500 g", price: 150, calories: 1000 }] }), 2);
  assert.equal(s.price, "100.00");
  assert.equal(s.calories, 1000);
  assert.equal(s.ingredients[0].qty, "250 g");
  assert.equal(s.ingredients[0].price, 75);
});
test("scaleMeal: serving_size 0/null guarded", () => {
  const s = scaleMeal(meal({ serving_size: null }), 2);
  assert.equal(s.price, "400.00");
});
test("multiplyQty: more range shapes", () => {
  assert.equal(multiplyQty("1 to 2 cups water", 2), "2 to 4 cups water");
  assert.equal(multiplyQty("2–3 pcs siling labuyo", 0.5), "1–1½ pcs siling labuyo");
  assert.equal(multiplyQty("1/2-1 cup rice", 2), "1-2 cup rice");
  assert.equal(multiplyQty("2 - 3 cloves", 3), "6 - 9 cloves");
  assert.equal(multiplyQty("1 (400g) can coconut milk", 2), "2 (400g) can coconut milk");
  assert.equal(multiplyQty("2 tbsp to taste", 2), "4 tbsp to taste");
});
