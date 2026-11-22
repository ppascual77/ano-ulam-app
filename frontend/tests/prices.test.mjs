// Price Watch: items DA stopped reporting (BUG-11).
// Run: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";
import { markStale, pickFreshPicks, pickPriceRises } from "@/frontend/core/prices/utils/prices";

const item = (id, latestDate, pctChange, category = "vegetables") => ({
  id, name: id, category, latestDate, latestPrice: 100, weekAgoPrice: pctChange == null ? null : 110, pctChange,
});

test("prices: an item 3+ days behind DA's newest report is stale, its change dropped", () => {
  const [fresh, edge, old] = markStale([item("tomato", "2026-11-21", -5), item("onion", "2026-11-18", 4), item("potato", "2026-11-06", -20)]);
  assert.equal(fresh.stale, false);
  assert.equal(fresh.pctChange, -5);
  assert.equal(edge.stale, false, "exactly 3 days behind still counts");
  assert.equal(old.stale, true);
  assert.equal(old.pctChange, null);
  assert.equal(old.weekAgoPrice, null);
});

test("prices: measured from the newest report, not today (DA quiet for days)", () => {
  const items = markStale([item("tomato", "2026-11-01", -5), item("onion", "2026-10-31", 4)]);
  assert.deepEqual(items.map((i) => i.stale), [false, false]);
});

test("prices: stale items stay off the Dropped and Went up boards", () => {
  const items = markStale([item("tomato", "2026-11-21", -5), item("potato", "2026-11-06", -20), item("garlic", "2026-11-05", 30, "spices")]);
  assert.deepEqual(pickFreshPicks(items, 5).map((i) => i.id), ["tomato"]);
  assert.deepEqual(pickPriceRises(items, 5).map((i) => i.id), []);
});

test("prices: no items, nothing to mark", () => {
  assert.deepEqual(markStale([]), []);
});

test("prices: search matches every word across name, spec and DA's section", async () => {
  const { matchesPriceSearch } = await import("@/frontend/core/prices/utils/prices");
  const chop = { name: "Chop, Local", specification: "Fresh or Chilled", section: "PORK" };
  assert.equal(matchesPriceSearch(chop, "pork chop"), true);
  assert.equal(matchesPriceSearch(chop, "Chop  pork"), true);
  assert.equal(matchesPriceSearch(chop, "chilled"), true);
  assert.equal(matchesPriceSearch(chop, "beef chop"), false);
  assert.equal(matchesPriceSearch(chop, ""), true);
  assert.equal(matchesPriceSearch({ name: "Tomato", specification: "", section: null }, "tom"), true);
});

test("prices: meat cuts get the animal from DA's section, once", async () => {
  const { priceItemName } = await import("@/frontend/core/prices/utils/prices");
  assert.equal(priceItemName("Chop, Local", "PORK"), "Pork Chop, Local");
  assert.equal(priceItemName("Liver (Atay), Local", "PORK OFFALS"), "Pork Liver (Atay), Local");
  assert.equal(priceItemName("Meat, Local", "BUFFALO"), "Carabeef Meat, Local");
  assert.equal(priceItemName("Whole Duck", "DUCK"), "Whole Duck");
  assert.equal(priceItemName("Pork Chop, Imported", "PORK MEAT PRODUCTS"), "Pork Chop, Imported");
  assert.equal(priceItemName("Chicken Egg (Brown, Large)", "EGG"), "Chicken Egg (Brown, Large)");
  assert.equal(priceItemName("Tomato", "LOWLAND VEGETABLES"), "Tomato");
  assert.equal(priceItemName("Tomato", null), "Tomato");
});
