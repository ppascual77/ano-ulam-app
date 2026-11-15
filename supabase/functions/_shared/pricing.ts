// Ingredient and meal price math, shared by the app (api/meals.ts,
// api/ingredients.ts, api/daPrices.ts re-export these) and the daily DA
// import (ingest-da-daily-prices), so both compute exactly the same numbers.
// Pure and self-contained: no imports, so Deno and Metro can both load it.
// Types are structural (just the fields used), so the app's generated row
// types fit them as they are.

export type PricingIngredient = {
  canonical_name: string;
  basis_amount: number;
  basis_unit: string;
  grams_per_piece: number | null;
  grams_per_ml: number | null;
  calories: number | null;
  protein: number | null;
  carbohydrates: number | null;
  fat: number | null;
  estimated_price: number | null;
  estimated_price_unit: string | null;
};

// ---- quantities ----------------------------------------------------------------
// g/kg and ml/L are ingredient-independent; going between weight and
// volume/piece needs the ingredient's own grams_per_ml/grams_per_piece
// bridge. Converts into whatever basis_unit that ingredient's macros are
// stored in ('g' or 'ml'), since not everything is stored per-100g (liquid
// dairy, vinegars, etc. use per-100ml).

export type QuantityConversion = { ok: true; basisAmount: number; basisUnit: string } | { ok: false; reason: string };

export function convertQuantityToBasis(amount: number, unit: string, ingredient: PricingIngredient): QuantityConversion {
  let grams: number | null = null;
  let ml: number | null = null;

  if (unit === "g") grams = amount;
  else if (unit === "kg") grams = amount * 1000;
  else if (unit === "ml") ml = amount;
  else if (unit === "L") ml = amount * 1000;
  else if (unit === "piece") {
    if (ingredient.grams_per_piece == null) {
      return { ok: false, reason: `${ingredient.canonical_name} has no grams_per_piece bridge set` };
    }
    grams = amount * ingredient.grams_per_piece;
  } else {
    return { ok: false, reason: `Unrecognized unit "${unit}"` };
  }

  if (ingredient.basis_unit === "g") {
    if (grams != null) return { ok: true, basisAmount: grams, basisUnit: "g" };
    // have ml, need grams
    if (ingredient.grams_per_ml == null) {
      return { ok: false, reason: `${ingredient.canonical_name} has no grams_per_ml bridge set` };
    }
    return { ok: true, basisAmount: (ml as number) * ingredient.grams_per_ml, basisUnit: "g" };
  }

  if (ingredient.basis_unit === "ml") {
    if (ml != null) return { ok: true, basisAmount: ml, basisUnit: "ml" };
    // have grams, need ml
    if (ingredient.grams_per_ml == null) {
      return { ok: false, reason: `${ingredient.canonical_name} has no grams_per_ml bridge set` };
    }
    return { ok: true, basisAmount: (grams as number) / ingredient.grams_per_ml, basisUnit: "ml" };
  }

  return { ok: false, reason: `${ingredient.canonical_name} has an unrecognized basis_unit "${ingredient.basis_unit}"` };
}

// ---- one line's macros and price ----------------------------------------------

export type ProposedTotals = {
  calories: number | null;
  protein: number | null;
  carbohydrates: number | null;
  fat: number | null;
  price: number | null;
};

// Scales an ingredient's per-basis_amount macros/price to the actual
// quantity used. Price is scaled independently since estimated_price_unit
// isn't always the same unit as basis_unit (e.g. priced per 'kg' while
// macros are stored per-100'g'). When the two are in different domains
// (broth priced per L with macros per 100 g), grams_per_ml converts
// between them; without it the price is null rather than a guess.
export function computeProposedTotals(ingredient: PricingIngredient, conversion: QuantityConversion): ProposedTotals {
  if (!conversion.ok) {
    return { calories: null, protein: null, carbohydrates: null, fat: null, price: null };
  }
  const macroScale = conversion.basisAmount / ingredient.basis_amount;
  const scaleOrNull = (v: number | null) => (v == null ? null : v * macroScale);

  let price: number | null = null;
  if (ingredient.estimated_price != null && ingredient.estimated_price_unit) {
    const priceUnit = ingredient.estimated_price_unit;
    const isWeightUnit = priceUnit === "g" || priceUnit === "kg";
    const isVolumeUnit = priceUnit === "ml" || priceUnit === "L";
    const conversionIsWeight = conversion.basisUnit === "g";
    const conversionIsVolume = conversion.basisUnit === "ml";
    const unitBase = priceUnit === "kg" || priceUnit === "L" ? 1000 : 1;
    const density = ingredient.grams_per_ml;
    let pricedAmount: number | null = null;
    if ((isWeightUnit && conversionIsWeight) || (isVolumeUnit && conversionIsVolume)) {
      pricedAmount = conversion.basisAmount;
    } else if (density != null && density > 0) {
      if (isVolumeUnit && conversionIsWeight) pricedAmount = conversion.basisAmount / density;
      else if (isWeightUnit && conversionIsVolume) pricedAmount = conversion.basisAmount * density;
    }
    if (pricedAmount != null) price = (ingredient.estimated_price / unitBase) * pricedAmount;
  }

  return {
    calories: scaleOrNull(ingredient.calories),
    protein: scaleOrNull(ingredient.protein),
    carbohydrates: scaleOrNull(ingredient.carbohydrates),
    fat: scaleOrNull(ingredient.fat),
    price,
  };
}

// Macros and price can reflect DIFFERENT effective quantities for the same
// row (bulk deep-frying oil: the cook buys a full cup, the dish absorbs a
// fraction). priceQuantityAmount/Unit override the quantity price is
// computed from; when either is null, price uses the macros' quantity.
export function computeItemTotals(
  ingredient: PricingIngredient,
  quantityAmount: number,
  quantityUnit: string,
  priceQuantityAmount?: number | null,
  priceQuantityUnit?: string | null,
): ProposedTotals {
  const macroConversion = convertQuantityToBasis(quantityAmount, quantityUnit, ingredient);
  const macroTotals = computeProposedTotals(ingredient, macroConversion);

  const hasOverride = priceQuantityAmount != null && priceQuantityUnit != null;
  const priceTotals = hasOverride
    ? computeProposedTotals(ingredient, convertQuantityToBasis(priceQuantityAmount, priceQuantityUnit, ingredient))
    : macroTotals;

  return { ...macroTotals, price: priceTotals.price };
}

// ---- a whole meal ----------------------------------------------------------------

export type PricingMealLine = {
  quantity_amount: number | null;
  quantity_unit: string | null;
  price_quantity_amount: number | null;
  price_quantity_unit: string | null;
  ingredient: PricingIngredient;
};

export type MealTotals = { calories: number; protein: number; carbohydrates: number; fat: number; price: number };

// Sums EVERY line with a usable quantity, main and pantry alike.
// Unquantified lines ("to taste") contribute nothing.
export function mealTotals(lines: PricingMealLine[]): MealTotals {
  const totals: MealTotals = { calories: 0, protein: 0, carbohydrates: 0, fat: 0, price: 0 };
  for (const line of lines) {
    if (line.quantity_amount == null || line.quantity_unit == null) continue;
    const item = computeItemTotals(
      line.ingredient,
      line.quantity_amount,
      line.quantity_unit,
      line.price_quantity_amount,
      line.price_quantity_unit,
    );
    totals.calories += item.calories ?? 0;
    totals.protein += item.protein ?? 0;
    totals.carbohydrates += item.carbohydrates ?? 0;
    totals.fat += item.fat ?? 0;
    totals.price += item.price ?? 0;
  }
  return totals;
}

// ---- an ingredient's price ---------------------------------------------------------

// One place an ingredient can be bought, in ₱ per kg or L: a supermarket
// listing (price_sources) or a linked DA commodity's latest price.
export type PriceOption = { source: "supermarket" | "da"; pricePerUnit: number; unit: "kg" | "L" };

// A pack estimate (price_sources entry with estimate: true) isn't a store
// price, so it never sets estimated_price.
export function isPackEstimateSource(source: unknown): boolean {
  return !!source && typeof source === "object" && (source as { estimate?: unknown }).estimate === true;
}

// price_sources is jsonb, so its shape isn't enforced by the DB.
export function supermarketPriceOptions(priceSources: unknown): PriceOption[] {
  if (!Array.isArray(priceSources)) return [];
  return priceSources.flatMap((s) =>
    s && !isPackEstimateSource(s) && typeof s.pricePerUnit === "number" && (s.unit === "kg" || s.unit === "L")
      ? [{ source: "supermarket" as const, pricePerUnit: s.pricePerUnit, unit: s.unit as "kg" | "L" }]
      : [],
  );
}

// The cheapest option sets estimated_price. Only options in one unit are
// compared: the first DA one's when there is one, since DA is the reference.
export function cheapestPriceOption(options: PriceOption[]): PriceOption | null {
  if (options.length === 0) return null;
  const unit = (options.find((o) => o.source === "da") ?? options[0]).unit;
  return options.filter((o) => o.unit === unit).reduce((best, o) => (o.pricePerUnit < best.pricePerUnit ? o : best));
}

export type PricePatch = {
  estimated_price: number;
  estimated_price_unit: "kg" | "L";
  price_source: "supermarket" | "da";
  price_last_updated_at: string;
};

// The price fields for the cheapest option, or null when there's no option
// or the ingredient already has exactly that price.
export function cheapestPricePatch(
  ingredient: { estimated_price: number | null; estimated_price_unit: string | null; price_source: string | null },
  options: PriceOption[],
): PricePatch | null {
  const best = cheapestPriceOption(options);
  if (!best) return null;
  const price = Math.round(best.pricePerUnit * 100) / 100;
  if (
    ingredient.estimated_price === price &&
    ingredient.estimated_price_unit === best.unit &&
    ingredient.price_source === best.source
  ) {
    return null;
  }
  return {
    estimated_price: price,
    estimated_price_unit: best.unit,
    price_source: best.source,
    price_last_updated_at: new Date().toISOString(),
  };
}

// DA's price as a price option in the units estimated_price allows:
// kg as is; bottle (oil) ÷ liters per bottle → ₱/L; piece (eggs) ÷ grams
// per piece → ₱/kg, using DA's stated size or else the ingredient's own
// grams_per_piece. null when there's no size to convert with.
export function daPriceOption(
  commodity: { unit: string; unit_size: number | null },
  price: number,
  ingredient: { grams_per_piece: number | null },
): PriceOption | null {
  if (commodity.unit === "kg") return { source: "da", pricePerUnit: price, unit: "kg" };
  if (commodity.unit === "bottle") {
    return commodity.unit_size ? { source: "da", pricePerUnit: price / commodity.unit_size, unit: "L" } : null;
  }
  const grams = commodity.unit_size ?? ingredient.grams_per_piece;
  return grams ? { source: "da", pricePerUnit: (price / grams) * 1000, unit: "kg" } : null;
}

export type DaPrice = { commodity: { unit: string; unit_size: number | null }; price: number };

// The ingredient's price fields given its linked DA prices: the cheapest of
// those and its supermarket listings. null when nothing changes.
export function ingredientPricePatch(
  ingredient: {
    estimated_price: number | null;
    estimated_price_unit: string | null;
    price_source: string | null;
    price_sources: unknown;
    grams_per_piece: number | null;
  },
  daPrices: DaPrice[],
): PricePatch | null {
  const daOptions = daPrices.flatMap(({ commodity, price }) => daPriceOption(commodity, price, ingredient) ?? []);
  return cheapestPricePatch(ingredient, [...supermarketPriceOptions(ingredient.price_sources), ...daOptions]);
}
