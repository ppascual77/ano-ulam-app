// /seed-meal's tool: one entry point, many subcommands, all built on the
// same api/ and admin utils code the Seed Meal screen uses (see hooks.mjs).
// Run from the project root:
//   node --env-file=.env --no-warnings --import ./.claude/skills/seed-meal/scripts/register.mjs \
//     .claude/skills/seed-meal/scripts/seed.ts <command> [args...]
// The meal being built lives in a session file (.claude/seed-sessions/,
// gitignored); `import` starts one and makes it current.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  addMealIngredient,
  createMeal,
  generateMealImage,
  getIngredientsForMatching,
  getMealsUsingIngredients,
  importMealFromUrl,
  matchIngredientCandidates,
  parseQuantityText,
  recomputeMealTotals,
  recomputeMealsUsingIngredient,
  updateMeal,
  type ImportedMealDraft,
  type QuantityUnit,
} from "@/api/meals";
import {
  applyPriceMatch,
  createIngredient,
  estimateIngredientAi,
  groundIngredientPrices,
  groundIngredientsUsda,
  isBridgeLocked,
  isMacrosVerified,
  isPriceVerified,
  updateIngredient,
  type IngredientRow,
  type PriceGroundingCandidate,
} from "@/api/ingredients";
import { daPriceOption, getDaCommodities, ingredientPricePatch, linkDaCommodity, linkedDaPrices } from "@/api/daPrices";
import { supabase } from "@/lib/supabase";
import { buildMealCalculation } from "@/frontend/features/admin/utils/mealCalculation";
import { findCopiedRuns, MIN_COPIED_WORDS } from "@/frontend/features/admin/utils/verbatimCheck";
import {
  draftToFormState,
  filledIngredients,
  mealIngredientInput,
  mealInsertFromForm,
} from "@/frontend/features/admin/utils/mealDraft";
import type { MealFormState } from "@/frontend/features/admin/components/MealFormFields";
import type { PendingMealIngredient } from "@/frontend/features/admin/components/SeedMealIngredientsEditor";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const SESSIONS = join(ROOT, ".claude/seed-sessions");
const CURRENT = join(SESSIONS, "current");
const UNITS = new Set(["g", "kg", "ml", "L", "piece"]);

type Session = {
  url: string;
  sourceText: string | null;
  draft: ImportedMealDraft;
  form: MealFormState;
  // Line keys the admin approved, in the line-by-line review.
  approved: string[];
  // Procedure steps / description the admin approved after the rewrite.
  copyApproved: boolean;
  // Fresh-eyes review done (its concerns discussed).
  reviewed: boolean;
  imagePath: string | null;
  savedMealId: string | null;
  // Price lookups kept between `prices` and `apply-prices`.
  priceLookups?: Record<string, PriceGroundingCandidate[]>;
};

// ---- helpers ----------------------------------------------------------------

const out = (...lines: (string | false | null | undefined)[]) => console.log(lines.filter((l) => l !== false && l != null).join("\n"));
const fail = (message: string): never => {
  console.error(`ERROR: ${message}`);
  process.exit(1);
};
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const round = (n: number | null | undefined, digits = 1) => (n == null ? "–" : String(Math.round(n * 10 ** digits) / 10 ** digits));
const peso = (n: number | null | undefined) => (n == null ? "₱–" : `₱${n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString()}`);

function sessionPath(): string {
  if (!existsSync(CURRENT)) fail("No current session. Run `import <url>` first.");
  return readFileSync(CURRENT, "utf8").trim();
}
function load(): Session {
  return JSON.parse(readFileSync(sessionPath(), "utf8")) as Session;
}
function save(session: Session) {
  writeFileSync(sessionPath(), JSON.stringify(session, null, 2));
}
function readJsonArg(arg: string | undefined, what: string): Record<string, unknown> {
  if (!arg) return fail(`Missing ${what} (inline JSON or a path to a .json file)`);
  const text = existsSync(arg) && statSync(arg).isFile() ? readFileSync(arg, "utf8") : arg;
  try {
    return JSON.parse(text);
  } catch {
    return fail(`${what} isn't valid JSON`);
  }
}
function line(session: Session, key: string): PendingMealIngredient {
  return session.form.ingredients.find((i) => i.key === key) ?? fail(`No line with key "${key}". Run \`lines\`.`);
}
async function ingredientById(id: string): Promise<IngredientRow> {
  const { data, error } = await supabase.from("ingredients").select("*").eq("id", id).single();
  if (error || !data) fail(`No ingredient ${id}`);
  return data as IngredientRow;
}
function significantWords(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2 && !["with", "and", "the", "style"].includes(w));
}

// What's verified on an ingredient, e.g. "✓macros ✓price ✓piece".
function armour(i: IngredientRow): string {
  const parts = [
    isMacrosVerified(i) ? "✓macros" : "·macros",
    isPriceVerified(i) ? "✓price" : "·price",
    i.grams_per_piece != null ? (isBridgeLocked(i, "grams_per_piece") ? "✓piece" : "·piece") : null,
    i.grams_per_ml != null ? (isBridgeLocked(i, "grams_per_ml") ? "✓density" : "·density") : null,
  ];
  return parts.filter(Boolean).join(" ");
}
function fullyArmoured(i: IngredientRow, unit: QuantityUnit | null): boolean {
  if (!isMacrosVerified(i) || !isPriceVerified(i)) return false;
  if (unit === "piece" && !isBridgeLocked(i, "grams_per_piece")) return false;
  const volume = unit === "ml" || unit === "L";
  if (volume && i.basis_unit === "g" && !isBridgeLocked(i, "grams_per_ml")) return false;
  return true;
}
function describeIngredient(i: IngredientRow): string[] {
  const sources = Array.isArray(i.price_sources) ? (i.price_sources as Record<string, unknown>[]) : [];
  return [
    `${i.canonical_name}${i.display_name ? ` (${i.display_name})` : ""}  [${i.id}]`,
    `  state ${i.state ?? "–"} · category ${i.category ?? "–"} · aliases ${i.aliases.join(", ") || "–"}`,
    `  macros per ${i.basis_amount}${i.basis_unit}: ${round(i.calories)} kcal · P ${round(i.protein)} · C ${round(i.carbohydrates)} · F ${round(i.fat)}` +
      ` · source ${i.source ?? "–"}${i.source_description ? ` "${i.source_description}"` : ""}${i.source_ref_id ? ` #${i.source_ref_id}` : ""}`,
    `  price ${i.estimated_price ?? "–"}/${i.estimated_price_unit ?? "–"} from ${i.price_source}` +
      (sources.length ? ` · listings: ${sources.map((s) => `${s.store ?? (s.estimate ? "pack estimate" : "?")} ${s.pricePerUnit ?? ""}/${s.unit ?? ""}`).join("; ")}` : ""),
    `  bridges: ${i.grams_per_piece ?? "–"} g per ${i.piece_label ?? "piece"} · ${i.grams_per_ml ?? "–"} g/ml${i.bridge_note ? ` · note "${i.bridge_note}"` : ""}`,
    `  armour: ${armour(i)}`,
  ];
}

// ---- commands ---------------------------------------------------------------

async function cmdImport(url: string | undefined) {
  if (!url) fail("Usage: import <url>");
  const { meal: draft, source_text, extraction_tier } = await importMealFromUrl(url!);
  mkdirSync(SESSIONS, { recursive: true });
  const path = join(SESSIONS, `${new Date().toISOString().slice(0, 10)}-${slugify(draft.name)}.json`);
  const session: Session = {
    url: url!,
    sourceText: source_text ?? null,
    draft,
    form: draftToFormState(draft),
    approved: [],
    copyApproved: false,
    reviewed: false,
    imagePath: null,
    savedMealId: null,
  };
  writeFileSync(path, JSON.stringify(session, null, 2));
  writeFileSync(CURRENT, path);

  // Duplicates: the same link imported before, or a catalog meal sharing
  // most of this dish's significant words (any status, archived included).
  const { data: sameUrl } = await supabase.from("meal_sources").select("meal_id").eq("url", url!);
  const { data: meals } = await supabase.from("meals").select("id, name, status, archived_at");
  const words = new Set(significantWords(draft.name));
  const similar = (meals ?? []).filter((m) => {
    const mw = significantWords(m.name);
    const overlap = mw.filter((w) => words.has(w)).length;
    return overlap > 0 && overlap >= Math.min(words.size, mw.length) * 0.6;
  });

  out(
    `Session: ${path}`,
    `Imported "${draft.name}" (${extraction_tier}) · serves ${draft.servings ?? "?"} · prep ${draft.prep_time ?? "?"} / total ${draft.total_time ?? "?"} min`,
    `Protein ${draft.protein_type ?? "–"} · difficulty ${draft.difficulty ?? "–"} · tags ${draft.tags.join(", ") || "–"}`,
    sameUrl?.length ? `DUPLICATE LINK: already imported as meal ${sameUrl.map((r) => r.meal_id).join(", ")}` : "Link not imported before.",
    similar.length
      ? `SIMILAR MEALS: ${similar.map((m) => `${m.name} (${m.status}${m.archived_at ? ", archived" : ""})`).join("; ")}`
      : "No similar meal names in the catalog.",
    source_text ? "Copy check: source text captured." : "Copy check: NO source text (import-meal-from-url needs redeploy); save will be blocked.",
    "",
    `${session.form.ingredients.length} ingredient lines, ${draft.procedure.length} steps. Next: \`lines\`.`,
  );
}

async function cmdLines() {
  const session = load();
  const all = await getIngredientsForMatching();
  const byId = new Map(all.map((i) => [i.id, i]));
  for (const item of session.form.ingredients) {
    const approved = session.approved.includes(item.key) ? "APPROVED" : "pending";
    const qty = item.quantityAmount ? `${item.quantityAmount} ${item.quantityUnit}` : "no qty";
    out(`[${item.key}] ${item.name} · "${item.displayText}"  →  ${qty}${item.section ? ` · section "${item.section}"` : ""} · ${approved}`);
    if (item.ingredientId) {
      const linked = byId.get(item.ingredientId);
      out(`    linked: ${linked ? `${linked.canonical_name} (${armour(linked)})${fullyArmoured(linked, item.quantityUnit) ? " FULLY VERIFIED" : ""}` : "missing!"}`);
      if (item.note) out(`    note: ${item.note}`);
      if (item.priceQuantityAmount) out(`    price qty override: ${item.priceQuantityAmount} ${item.priceQuantityUnit}`);
    } else {
      const candidates = matchIngredientCandidates(item.name, all, 3);
      out(
        candidates.length
          ? `    candidates: ${candidates.map((c) => `${c.ingredient.canonical_name} [${c.confidence}, ${armour(c.ingredient)}] {${c.ingredient.id}}`).join(" | ")}`
          : "    candidates: none in DB",
      );
    }
  }
}

async function cmdCandidates(query: string | undefined) {
  if (!query) fail("Usage: candidates <line-key or search text>");
  const session = existsSync(CURRENT) ? load() : null;
  const asLine = session?.form.ingredients.find((i) => i.key === query);
  const text = asLine ? asLine.name : query!;
  const all = await getIngredientsForMatching();
  const candidates = matchIngredientCandidates(text, all, 8);
  out(`Matches for "${text}":`);
  if (candidates.length === 0) out("  none. Try other words (Tagalog/English name), `usda <name>`, or `estimate <name>`.");
  for (const c of candidates) {
    const [first, ...rest] = describeIngredient(c.ingredient);
    out(`- [${c.confidence}] ${first}`, ...rest);
  }
}

async function cmdIngredient(id: string | undefined) {
  if (!id) fail("Usage: ingredient <id>");
  const i = await ingredientById(id!);
  const meals = await getMealsUsingIngredients([id!]);
  const { data: da } = await supabase.from("da_commodities").select("*").eq("ingredient_id", id!);
  out(
    ...describeIngredient(i),
    `  DA commodities: ${(da ?? []).map((c) => `${c.commodity} ${c.specification} ₱${c.latest_price ?? "–"}/${c.unit}${c.unit_size ? ` (${c.unit_size})` : ""} {${c.id}}`).join("; ") || "none linked"}`,
    `  used by ${meals.length} meal(s): ${meals.map((m) => m.name).join(", ") || "none"}`,
  );
}

async function cmdUsda(name: string | undefined) {
  if (!name) fail("Usage: usda <name>");
  const [result] = await groundIngredientsUsda([{ id: "lookup", canonicalName: name! }]);
  if (!result || result.confidence === "NONE") return out("No USDA match.");
  if (result.confidence === "ERROR") return fail(result.error);
  out(`USDA ${result.confidence} for "${name}":`);
  for (const c of result.candidates) {
    out(`- #${c.fdcId} ${c.description} (${c.dataType}) per 100 g: ${round(c.calories)} kcal · P ${round(c.protein)} · C ${round(c.carbohydrates)} · F ${round(c.fat)} · sugar ${round(c.sugar)} · fiber ${round(c.fiber)} · Na ${round(c.sodium)} mg`);
  }
}

async function cmdEstimate(name: string | undefined) {
  if (!name) fail("Usage: estimate <name>");
  const est = await estimateIngredientAi(name!);
  out(JSON.stringify(est, null, 2));
}

async function cmdLink(key: string | undefined, id: string | undefined, amount?: string, unit?: string) {
  if (!key || !id) fail("Usage: link <line-key> <ingredient-id> [amount] [unit]");
  const session = load();
  const item = line(session, key!);
  const ingredient = await ingredientById(id!);
  item.ingredientId = ingredient.id;
  item.ingredientName = ingredient.canonical_name;
  if (amount !== undefined) {
    if (unit && !UNITS.has(unit)) fail(`Unit must be one of ${[...UNITS].join(", ")}`);
    item.quantityAmount = amount;
    if (unit) item.quantityUnit = unit as QuantityUnit;
  }
  session.approved = session.approved.filter((k) => k !== key);
  save(session);
  out(`Linked [${key}] ${item.displayText} → ${ingredient.canonical_name}, ${item.quantityAmount || "no qty"} ${item.quantityUnit}. Not approved yet.`);
}

async function cmdSetLine(key: string | undefined, json: string | undefined) {
  if (!key) fail("Usage: set-line <line-key> <json>");
  const session = load();
  const item = line(session, key!);
  const patch = readJsonArg(json, "line patch") as Partial<PendingMealIngredient>;
  for (const field of ["quantityUnit", "priceQuantityUnit"] as const) {
    const v = patch[field];
    if (v !== undefined && v !== "" && !UNITS.has(v as string)) fail(`${field} must be one of ${[...UNITS].join(", ")}`);
  }
  delete (patch as Record<string, unknown>).key;
  Object.assign(item, patch);
  session.approved = session.approved.filter((k) => k !== key);
  save(session);
  out(`Updated [${key}]: ${JSON.stringify(item)}`);
}

async function cmdAddLine(json: string | undefined) {
  const session = load();
  const patch = readJsonArg(json, "new line") as Partial<PendingMealIngredient>;
  if (!patch.name) fail("A new line needs at least a name");
  const parsed = patch.displayText ? parseQuantityText(patch.displayText) : null;
  const item: PendingMealIngredient = {
    key: `added-${Date.now()}`,
    name: patch.name!,
    quantityAmount: parsed?.amount ?? "",
    quantityUnit: parsed?.unit ?? "g",
    displayText: patch.displayText ?? patch.name!,
    note: "",
    section: "",
    priceQuantityAmount: "",
    priceQuantityUnit: "",
    ingredientId: null,
    ingredientName: null,
    ...patch,
  };
  session.form.ingredients.push(item);
  save(session);
  out(`Added [${item.key}] ${item.displayText}`);
}

async function cmdRemoveLine(key: string | undefined) {
  if (!key) fail("Usage: remove-line <line-key>");
  const session = load();
  line(session, key!);
  session.form.ingredients = session.form.ingredients.filter((i) => i.key !== key);
  session.approved = session.approved.filter((k) => k !== key);
  save(session);
  out(`Removed [${key}]`);
}

async function cmdApprove(keys: string[]) {
  if (keys.length === 0) fail("Usage: approve <line-key> [more keys]");
  const session = load();
  for (const key of keys) {
    const item = line(session, key);
    if (!item.ingredientId) fail(`[${key}] isn't linked yet`);
    if (!session.approved.includes(key)) session.approved.push(key);
  }
  save(session);
  const total = filledIngredients(session.form).length;
  out(`Approved ${keys.join(", ")}. ${session.approved.length} of ${total} lines approved.`);
}

// Marks what the admin approved on an ingredient as verified. Values are
// not changed here (use update-ingredient for that), so nothing to recompute.
async function cmdArmour(id: string | undefined, fieldsArg: string | undefined, ...rest: string[]) {
  if (!id || !fieldsArg) fail("Usage: armour <ingredient-id> <macros,price,piece,density> [--note \"bridge source\"]");
  const i = await ingredientById(id!);
  const now = new Date().toISOString();
  const patch: Partial<IngredientRow> = {};
  for (const field of fieldsArg!.split(",").map((f) => f.trim())) {
    if (field === "macros") {
      if (i.calories == null) fail(`${i.canonical_name} has no calories to verify`);
      patch.macros_verified_at = now;
    } else if (field === "price") {
      if (i.estimated_price == null) fail(`${i.canonical_name} has no price to verify`);
      patch.price_verified_at = now;
    } else if (field === "piece") {
      if (i.grams_per_piece == null) fail(`${i.canonical_name} has no grams_per_piece to verify`);
      patch.piece_verified_at = now;
    } else if (field === "density") {
      if (i.grams_per_ml == null) fail(`${i.canonical_name} has no grams_per_ml to verify`);
      patch.density_verified_at = now;
    } else fail(`Unknown armour field "${field}"`);
  }
  const noteIndex = rest.indexOf("--note");
  if (noteIndex >= 0 && rest[noteIndex + 1]) patch.bridge_note = rest[noteIndex + 1];
  const updated = await updateIngredient(id!, patch);
  out(`${updated.canonical_name}: ${armour(updated)}`);
}

// An approved value change, through the same path as the app's edit sheet:
// update, then recompute every saved meal using the ingredient. A locked
// field only changes when the patch also re-stamps its lock (the DB
// enforces it), which happens only after the admin approved the change.
async function cmdUpdateIngredient(id: string | undefined, json: string | undefined) {
  if (!id) fail("Usage: update-ingredient <id> <json-patch>");
  const patch = readJsonArg(json, "ingredient patch") as Partial<IngredientRow>;
  const before = await getMealsUsingIngredients([id!]);
  const updated = await updateIngredient(id!, patch);
  const recomputed = await recomputeMealsUsingIngredient(id!);
  out(
    ...describeIngredient(updated),
    `Recomputed ${recomputed.length} saved meal(s)${before.length ? `: ${before.map((m) => m.name).join(", ")}` : ""}.`,
  );
}

async function cmdCreateIngredient(json: string | undefined) {
  const patch = readJsonArg(json, "new ingredient") as Partial<IngredientRow> & { canonical_name: string };
  if (!patch.canonical_name) fail("canonical_name is required");
  const created = await createIngredient({
    source: "manual",
    price_source: "manual",
    verification_status: "NEEDS_REVIEW",
    ...patch,
  });
  out("Created:", ...describeIngredient(created));
}

async function cmdPrices(id: string | undefined) {
  if (!id) fail("Usage: prices <ingredient-id>");
  const session = load();
  const i = await ingredientById(id!);
  const [result] = await groundIngredientPrices([i]);
  if (!result) return fail("No result");
  if (result.confidence === "ERROR") return fail(result.error);
  if (result.confidence === "NONE") return out(`No listings found: ${result.reason}`);
  session.priceLookups = { ...(session.priceLookups ?? {}), [id!]: result.candidates };
  save(session);
  out(`Listings for ${i.canonical_name} (${result.confidence}${result.usage ? `, cost $${result.usage.costUsd.toFixed(3)}` : ""}):`);
  result.candidates.forEach((c, n) =>
    out(`  ${n}. [${c.confidence}] ${c.store}: ${c.productTitle} · ₱${c.packPrice} for ${c.packSize}${c.packUnit} = ₱${round(c.pricePerUnit, 2)}/${c.unit} · ${c.url}${c.reasons.length ? ` · ${c.reasons.join("; ")}` : ""}`),
  );
}

// Same as the price grounding panel's apply: the chosen listings replace
// the supermarket sources, and the cheapest of those and DA sets the price.
async function cmdApplyPrices(id: string | undefined, indexes: string | undefined) {
  if (!id || !indexes) fail("Usage: apply-prices <ingredient-id> <0,1,...>");
  const session = load();
  const lookup = session.priceLookups?.[id!] ?? fail("Run `prices <id>` first");
  const chosen = indexes!.split(",").map((n) => lookup[Number(n)] ?? fail(`No listing ${n}`));
  const i = await ingredientById(id!);
  const { data: da } = await supabase.from("da_commodities").select("*").eq("ingredient_id", id!);
  const daOptions = linkedDaPrices(da ?? []).flatMap(({ commodity, price }) => daPriceOption(commodity, price, i) ?? []);
  await cmdUpdateIngredient(id, JSON.stringify(applyPriceMatch(i, chosen, daOptions)));
}

async function cmdDaSearch(text: string | undefined) {
  if (!text) fail("Usage: da-search <text>");
  const words = significantWords(text!);
  const commodities = await getDaCommodities();
  const hits = commodities.filter((c) => words.some((w) => `${c.commodity} ${c.specification}`.toLowerCase().includes(w)));
  if (hits.length === 0) return out("No DA commodity matches.");
  for (const c of hits.slice(0, 15)) {
    out(`- ${c.commodity} · ${c.specification} · ₱${c.latest_price ?? "–"}/${c.unit}${c.unit_size ? ` (${c.unit_size})` : ""} · ${c.latest_price_date ?? "no price yet"}${c.ingredient_id ? ` · linked to ${c.ingredient_id}` : ""} {${c.id}}`);
  }
}

// Same as the DA link panel: link, then re-pick the cheapest price.
async function cmdDaLink(commodityId: string | undefined, ingredientId: string | undefined) {
  if (!commodityId || !ingredientId) fail("Usage: da-link <commodity-id> <ingredient-id>");
  await linkDaCommodity(commodityId!, ingredientId!);
  const i = await ingredientById(ingredientId!);
  const { data: da } = await supabase.from("da_commodities").select("*").eq("ingredient_id", ingredientId!);
  const patch = ingredientPricePatch(i, linkedDaPrices(da ?? []));
  if (patch) await cmdUpdateIngredient(ingredientId, JSON.stringify(patch));
  else out(`Linked. ${i.canonical_name}'s price is unchanged (${i.estimated_price}/${i.estimated_price_unit} from ${i.price_source}).`);
}

async function calculation(session: Session) {
  const all = await getIngredientsForMatching();
  const items = filledIngredients(session.form);
  const unlinked = items.filter((i) => !i.ingredientId);
  return { all, items, unlinked, calc: unlinked.length ? null : buildMealCalculation(items, all) };
}

async function cmdCalc() {
  const session = load();
  const { unlinked, calc } = await calculation(session);
  if (!calc) return out(`${unlinked.length} line(s) not linked yet: ${unlinked.map((i) => i.key).join(", ")}`);
  const servings = Math.max(Number(session.form.servingSize) || 1, 1);
  for (const row of calc.rows) {
    const used = row.notCounted ? "not counted" : row.used ? `${round(row.used.amount)} ${row.used.unit}` : "–";
    out(`[${row.key}] ${row.displayText} → ${row.ingredient?.canonical_name ?? "?"} · ${used} · ${round(row.computed?.calories, 0)} kcal · ${peso(row.computed?.price)}`);
    for (const p of row.problems) out(`    ${p.level.toUpperCase()}: ${p.message}${p.fix ? ` (fix: ${p.fix.label} → ${JSON.stringify(p.fix.patch)})` : ""}`);
  }
  out(
    `Total ${Math.round(calc.totals.calories)} kcal · ${peso(calc.totals.price)} · per serving (${servings}): ${Math.round(calc.totals.calories / servings)} kcal · ${peso(calc.totals.price / servings)}`,
    calc.errorCount === 0 ? `Calculation check PASSES (${calc.warningCount} warning(s)).` : `Calculation check FAILS: ${calc.errorCount} error(s).`,
  );
}

async function cmdSetCopy(json: string | undefined) {
  const session = load();
  const patch = readJsonArg(json, "copy") as { description?: string; procedure?: string[]; name?: string };
  if (patch.description !== undefined) session.form.description = patch.description;
  if (patch.procedure !== undefined) session.form.procedure = patch.procedure;
  if (patch.name !== undefined) session.form.name = patch.name;
  session.copyApproved = false;
  save(session);
  out("Copy updated (not approved yet). Run `copy-check`.");
}

// Meal-level fields other than the copy: servings, times, tags, allergens.
const MEAL_FIELDS = ["servingSize", "prepTime", "totalTime", "difficulty", "proteinType", "budgetRange", "dietaryTags", "tags", "allergens"] as const;

async function cmdSetMeal(json: string | undefined) {
  const session = load();
  const patch = readJsonArg(json, "meal fields");
  for (const [field, value] of Object.entries(patch)) {
    if (!(MEAL_FIELDS as readonly string[]).includes(field)) fail(`set-meal only takes ${MEAL_FIELDS.join(", ")}`);
    (session.form as Record<string, unknown>)[field] = Array.isArray(value) ? value.map(String) : String(value);
  }
  save(session);
  out(`Updated: ${MEAL_FIELDS.map((f) => `${f} ${JSON.stringify(session.form[f])}`).join(" · ")}`);
}

function copyRuns(session: Session) {
  if (session.sourceText == null) return null;
  return findCopiedRuns(
    [
      { label: "Description", text: session.form.description },
      ...session.form.procedure.map((step, i) => ({ label: `Step ${i + 1}`, text: step })),
    ],
    session.sourceText,
  );
}

async function cmdCopyCheck() {
  const session = load();
  const runs = copyRuns(session);
  if (runs === null) return out("Can't check: no source text captured for this import. Save stays blocked.");
  if (runs.length === 0) return out(`Copy check PASSES: no ${MIN_COPIED_WORDS}+ word run shared with the source.`);
  out(`Copy check FAILS: ${runs.length} copied passage(s):`, ...runs.map((r) => `  ${r.label}: "${r.phrase}"`));
}

async function cmdSource() {
  const session = load();
  out(session.sourceText ?? "(no source text captured)");
}

async function cmdApproveCopy() {
  const session = load();
  session.copyApproved = true;
  save(session);
  out("Description and steps approved.");
}

// What a user would see, and nothing about how it was built: the input for
// the fresh-eyes review.
async function cmdPreview() {
  const session = load();
  const { calc, unlinked } = await calculation(session);
  const f = session.form;
  const servings = Math.max(Number(f.servingSize) || 1, 1);
  const sections = new Map<string, PendingMealIngredient[]>();
  for (const item of filledIngredients(f)) {
    const s = item.section || "Ingredients";
    sections.set(s, [...(sections.get(s) ?? []), item]);
  }
  out(
    `# ${f.name}`,
    f.description,
    `Serves ${servings} · prep ${f.prepTime || "?"} min · total ${f.totalTime || "?"} min · ${f.difficulty[0] ?? "?"} · protein ${f.proteinType || "–"}`,
    `Tags: ${[...f.tags, ...f.dietaryTags].join(", ") || "–"} · allergens: ${f.allergens.join(", ") || "none listed"}`,
    "",
  );
  for (const [name, items] of sections) {
    out(`## ${name}`);
    for (const item of items) {
      const row = calc?.rows.find((r) => r.key === item.key);
      // Small amounts keep a decimal (5 bay leaves are 0.5 g, not "1 g").
      const counted = row?.notCounted
        ? "not counted"
        : row?.used
          ? `counted as ${round(row.used.amount, row.used.amount < 10 ? 1 : 0)} ${row.used.unit}`
          : "not calculated";
      out(`- ${item.name}: ${item.displayText} (${row?.ingredient?.canonical_name ?? item.ingredientName ?? "unlinked"}, ${counted})${item.note ? ` · note: ${item.note}` : ""}`);
      // The data behind the line, so the reviewer can doubt it too. Never
      // says what's verified: the review must judge every value the same
      // way (the skill sorts verified challenges out afterwards).
      const i = row?.ingredient;
      if (i) {
        const piece = i.grams_per_piece != null ? ` · ${i.grams_per_piece} g per ${i.piece_label ?? "piece"}` : "";
        const density = i.grams_per_ml != null ? ` · ${i.grams_per_ml} g/ml` : "";
        out(
          `    data: per ${i.basis_amount} ${i.basis_unit} ${round(i.calories)} kcal, P ${round(i.protein)}, C ${round(i.carbohydrates)}, F ${round(i.fat)} (${i.source ?? "unsourced"})` +
            ` · ₱${i.estimated_price ?? "–"}/${i.estimated_price_unit ?? "–"} (${i.price_source})${piece}${density}`,
        );
      }
    }
  }
  out("", "## Steps", ...f.procedure.map((s, i) => `${i + 1}. ${s}`), "");
  if (calc) {
    const sum = (k: "protein" | "carbohydrates" | "fat") => calc.rows.reduce((t, r) => t + (r.computed?.[k] ?? 0), 0);
    out(
      `Per serving: ${Math.round(calc.totals.calories / servings)} kcal · ${peso(calc.totals.price / servings)} · P ${round(sum("protein") / servings)} g · C ${round(sum("carbohydrates") / servings)} g · F ${round(sum("fat") / servings)} g`,
      `Whole recipe: ${Math.round(calc.totals.calories)} kcal · ${peso(calc.totals.price)}`,
    );
  } else out(`(Totals pending: ${unlinked.length} line(s) not linked.)`);
}

async function cmdMarkReviewed() {
  const session = load();
  session.reviewed = true;
  save(session);
  out("Fresh-eyes review marked done.");
}

// Generated with the same edge function as Edit Meal (the source photo only
// steers a neutral text description, never copied), then compressed to a
// ~150 KB JPEG with macOS sips, like the app's compressImageForUpload.
async function cmdImage() {
  const session = load();
  const { imageBase64, mimeType } = await generateMealImage({
    name: session.form.name,
    description: session.form.description || null,
    referenceImageUrl: session.draft.reference_image_url,
  });
  const base = sessionPath().replace(/\.json$/, "");
  const raw = `${base}-image.${mimeType.split("/")[1] ?? "png"}`;
  writeFileSync(raw, Buffer.from(imageBase64, "base64"));
  const jpg = `${base}-image.jpg`;
  for (const [width, quality] of [[1200, 70], [1000, 60], [800, 50], [650, 40], [500, 30]]) {
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", String(quality), "--resampleWidth", String(width), raw, "--out", jpg], { stdio: "ignore" });
    if (statSync(jpg).size <= 150 * 1024) break;
  }
  session.imagePath = jpg;
  save(session);
  out(`Image: ${jpg} (${Math.round(statSync(jpg).size / 1024)} KB). Not uploaded until save.`);
}

async function cmdStatus() {
  const session = load();
  const { items, unlinked, calc } = await calculation(session);
  const runs = copyRuns(session);
  const unapproved = items.filter((i) => !session.approved.includes(i.key));
  out(
    `Session ${sessionPath()}`,
    `"${session.form.name}" from ${session.url}`,
    `Lines: ${items.length} · linked ${items.length - unlinked.length} · approved ${items.length - unapproved.length}${unapproved.length ? ` (pending: ${unapproved.map((i) => i.key).join(", ")})` : ""}`,
    `Calculation check: ${calc ? (calc.errorCount === 0 ? "passes" : `${calc.errorCount} error(s)`) : "waiting on links"}`,
    `Copy check: ${runs === null ? "no source text" : runs.length === 0 ? "passes" : `${runs.length} copied passage(s)`} · copy approved: ${session.copyApproved ? "yes" : "no"}`,
    `Fresh-eyes review: ${session.reviewed ? "done" : "not yet"} · image: ${session.imagePath ?? "none"}`,
    session.savedMealId ? `SAVED as meal ${session.savedMealId}` : "Not saved.",
  );
}

// Same Storage path scheme as uploadMealImage (`<mealId>/<timestamp>`),
// so deleteMeal's cleanup finds it.
async function uploadImage(mealId: string, imagePath: string) {
  const path = `${mealId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from("meal-images")
    .upload(path, readFileSync(imagePath), { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  await updateMeal(mealId, { image_url: supabase.storage.from("meal-images").getPublicUrl(path).data.publicUrl });
}

// A photo for a meal this session already saved (generated after saving,
// or a replacement).
async function cmdAttachImage() {
  const session = load();
  if (!session.savedMealId) fail("Not saved yet: `save` uploads the image itself.");
  if (!session.imagePath) fail("No image yet. Run `image` first.");
  await uploadImage(session.savedMealId!, session.imagePath!);
  out(`Photo set on meal ${session.savedMealId}.`);
}

// Same gates as Seed Meal's Confirm Seed, plus this flow's own: every line
// approved, copy approved, fresh-eyes review done.
async function cmdSave() {
  const session = load();
  if (session.savedMealId) fail(`Already saved as meal ${session.savedMealId}`);
  const { items, unlinked, calc } = await calculation(session);
  const runs = copyRuns(session);
  const blockers = [
    !session.form.name.trim() && "meal has no name",
    items.length === 0 && "no ingredient lines",
    unlinked.length > 0 && `${unlinked.length} line(s) not linked`,
    items.some((i) => !session.approved.includes(i.key)) && "not every line is approved",
    calc && calc.errorCount > 0 && `calculation check has ${calc.errorCount} error(s)`,
    runs === null && "copy check can't run (no source text)",
    runs && runs.length > 0 && `${runs.length} copied passage(s)`,
    !session.copyApproved && "description and steps not approved",
    !session.reviewed && "fresh-eyes review not done",
  ].filter(Boolean);
  if (blockers.length) fail(`Can't save yet:\n- ${blockers.join("\n- ")}`);

  const meal = await createMeal(mealInsertFromForm(session.draft, session.form));
  for (let i = 0; i < items.length; i++) await addMealIngredient(meal.id, mealIngredientInput(items[i], i));
  await recomputeMealTotals(meal.id);
  const { error: sourceError } = await supabase.from("meal_sources").insert({ meal_id: meal.id, url: session.url });
  if (sourceError) out(`Warning: couldn't record the source link: ${sourceError.message}`);

  if (session.imagePath) {
    try {
      await uploadImage(meal.id, session.imagePath);
    } catch (err) {
      out(`Warning: image upload failed: ${err instanceof Error ? err.message : err}. Run \`attach-image\` or add one in Edit Meal.`);
    }
  }

  session.savedMealId = meal.id;
  save(session);
  out(`Saved "${meal.name}" as meal ${meal.id} (approved, in the catalog).`);
}

async function cmdUse(path: string | undefined) {
  if (!path || !existsSync(path)) fail("Usage: use <session-file>");
  writeFileSync(CURRENT, resolve(path!));
  await cmdStatus();
}

// ---- dispatch ---------------------------------------------------------------

const [command, ...args] = process.argv.slice(2);
const commands: Record<string, (...a: string[]) => Promise<void>> = {
  import: cmdImport,
  lines: cmdLines,
  candidates: (...a) => cmdCandidates(a.join(" ")),
  ingredient: cmdIngredient,
  usda: (...a) => cmdUsda(a.join(" ")),
  estimate: (...a) => cmdEstimate(a.join(" ")),
  link: cmdLink,
  "set-line": cmdSetLine,
  "add-line": cmdAddLine,
  "remove-line": cmdRemoveLine,
  approve: (...a) => cmdApprove(a),
  armour: cmdArmour,
  "update-ingredient": cmdUpdateIngredient,
  "create-ingredient": cmdCreateIngredient,
  prices: cmdPrices,
  "apply-prices": cmdApplyPrices,
  "da-search": (...a) => cmdDaSearch(a.join(" ")),
  "da-link": cmdDaLink,
  calc: cmdCalc,
  "set-copy": cmdSetCopy,
  "set-meal": cmdSetMeal,
  "copy-check": cmdCopyCheck,
  source: cmdSource,
  "approve-copy": cmdApproveCopy,
  preview: cmdPreview,
  "mark-reviewed": cmdMarkReviewed,
  image: cmdImage,
  "attach-image": cmdAttachImage,
  status: cmdStatus,
  save: cmdSave,
  use: cmdUse,
};

if (!command || !commands[command]) {
  out(`Commands: ${Object.keys(commands).join(", ")}`);
  process.exit(command ? 1 : 0);
}
await commands[command](...args).catch((err: unknown) => fail(err instanceof Error ? err.message : JSON.stringify(err)));
