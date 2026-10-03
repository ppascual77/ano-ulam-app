import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Trash2, Check, Info } from "lucide-react-native";
import { AppText, Button, Dropdown, NoticeBanner, TextField, SelectField } from "@/frontend/components/ui";
import type { DropdownItem } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import {
  applyUsdaMatch,
  classifyUsdaConfidence,
  createIngredient,
  estimateIngredientAi,
  estimateIngredientGaps,
  groundIngredientsUsda,
  updateIngredient,
  type AiIngredientEstimate,
  type IngredientRow,
  type UsdaGroundingMatch,
} from "@/api/ingredients";
import {
  computeItemTotals,
  convertQuantityToBasis,
  matchIngredientCandidates,
  type ProposedTotals,
  type QuantityUnit,
} from "@/api/meals";
import { errorMessage } from "@/lib/errorMessage";
import { useConfirmedIngredientUpdate } from "../hooks/useConfirmedIngredientUpdate";
import { IngredientEditSheet } from "./IngredientEditSheet";
import { ConfirmIngredientSheet } from "./ConfirmIngredientSheet";
import { ConfirmIngredientUpdateSheet } from "./ConfirmIngredientUpdateSheet";

export type { QuantityUnit };

export type PendingMealIngredient = {
  key: string;
  name: string;
  quantityAmount: string;
  quantityUnit: QuantityUnit;
  displayText: string;
  // Shown to every viewer (not just admin) alongside this ingredient when
  // the counted quantity differs from what displayText states and needs a
  // short explanation — e.g. bulk deep-frying oil where only a fraction is
  // actually absorbed.
  note: string;
  // Overrides the quantity PRICE is computed from, independent of
  // quantityAmount/quantityUnit (which macros always use). Empty string =
  // no override, price falls back to the same quantity as macros — the
  // common case. Set together, both or neither.
  priceQuantityAmount: string;
  priceQuantityUnit: QuantityUnit | "";
  ingredientId: string | null;
  ingredientName: string | null; // for display once resolved, without refetching
};

const UNIT_OPTIONS: { id: QuantityUnit; label: string }[] = [
  { id: "g", label: "g" },
  { id: "kg", label: "kg" },
  { id: "ml", label: "ml" },
  { id: "L", label: "L" },
  { id: "piece", label: "piece" },
];

let counter = 0;
export function newPendingIngredient(): PendingMealIngredient {
  counter += 1;
  return {
    key: `pending-${Date.now()}-${counter}`,
    name: "",
    quantityAmount: "",
    quantityUnit: "g",
    displayText: "",
    note: "",
    priceQuantityAmount: "",
    priceQuantityUnit: "",
    ingredientId: null,
    ingredientName: null,
  };
}

export function resolvePendingIngredient(
  items: PendingMealIngredient[],
  key: string,
  ingredient: IngredientRow,
): PendingMealIngredient[] {
  return items.map((item) =>
    item.key === key
      ? {
          ...item,
          ingredientId: ingredient.id,
          ingredientName: ingredient.canonical_name,
          displayText: item.displayText.trim() || `${item.quantityAmount} ${item.quantityUnit}`,
        }
      : item,
  );
}

type UsdaSearchState = { loading: boolean; candidates: UsdaGroundingMatch[] | null; error: string | null };

type ItemContribution =
  | { status: "unlinked" }
  | { status: "no_quantity" }
  | { status: "error"; reason: string }
  | { status: "ok"; totals: ProposedTotals };

// The same conversion/scaling pipeline recomputeMealTotals uses server-side,
// run here client-side so the admin sees a live "this is what will actually
// get counted" preview WHILE editing — not just after saving. This is
// exactly the surface that would have caught a "main" ingredient silently
// contributing nothing because its grams_per_piece bridge was never set:
// instead of a suspiciously-low total discovered later, the row itself
// shows "Can't calculate: ... has no grams_per_piece bridge set".
function computeItemContribution(item: PendingMealIngredient, allIngredients: IngredientRow[]): ItemContribution {
  if (!item.ingredientId) return { status: "unlinked" };
  const ingredient = allIngredients.find((i) => i.id === item.ingredientId);
  if (!ingredient) return { status: "unlinked" };

  const amount = Number(item.quantityAmount);
  if (item.quantityAmount.trim() === "" || Number.isNaN(amount)) return { status: "no_quantity" };

  const conversion = convertQuantityToBasis(amount, item.quantityUnit, ingredient);
  if (!conversion.ok) return { status: "error", reason: conversion.reason };

  const priceAmount = item.priceQuantityAmount.trim() !== "" ? Number(item.priceQuantityAmount) : null;
  const totals = computeItemTotals(
    ingredient,
    amount,
    item.quantityUnit,
    priceAmount != null && !Number.isNaN(priceAmount) ? priceAmount : null,
    item.priceQuantityUnit || null,
  );

  return { status: "ok", totals };
}

function contributionLabel(totals: ProposedTotals): string {
  const parts: string[] = [];
  if (totals.price != null) parts.push(`₱${totals.price.toFixed(2)}`);
  if (totals.calories != null) parts.push(`${totals.calories.toFixed(0)} cal`);
  if (totals.protein != null) parts.push(`${totals.protein.toFixed(1)}g P`);
  if (totals.carbohydrates != null) parts.push(`${totals.carbohydrates.toFixed(1)}g C`);
  if (totals.fat != null) parts.push(`${totals.fat.toFixed(1)}g F`);
  return parts.length > 0 ? parts.join(" · ") : "no price/macro data";
}

// Oil absorption during frying is a property of the FOOD (surface area,
// breading, fry time), not a percentage of how much oil was in the pot —
// frying in 1 cup vs 2 cups of oil doesn't mean ~2x gets absorbed, as long
// as there's enough to submerge the food either way. So this is a fixed,
// portion-agnostic estimate, not a fraction of whatever was poured.
// 30g (~2 tbsp) comfortably exceeds any directly-consumed amount (a
// dressing, a sauté) while sitting well below what a pot needs to fry in
// (a cup ≈ 217g) — clean separation between the two real usage patterns
// this app's ingredients.category === "Oils" currently conflates.
const OIL_BULK_THRESHOLD_G = 30;
// ~1 tbsp — inside the commonly-cited 5-15g retained-oil-per-100g-of-
// fried-food range for a typical single-serving portion. A starting
// point the admin can override, not a precise verdict.
const OIL_ABSORBED_SUGGESTION_G = 14;

// Deliberately separate from computeItemContribution/ItemContribution —
// this answers an orthogonal "is this worth a second look" question, not
// "what does this row contribute" (which stays true and unaffected until
// the admin actually edits the row).
function bulkFryingOilHint(item: PendingMealIngredient, ingredient: IngredientRow | null | undefined): boolean {
  if (!ingredient || ingredient.category !== "Oils") return false;

  const amount = Number(item.quantityAmount);
  if (item.quantityAmount.trim() === "" || Number.isNaN(amount)) return false;

  const conversion = convertQuantityToBasis(amount, item.quantityUnit, ingredient);
  if (!conversion.ok) return false;

  const grams =
    conversion.basisUnit === "g"
      ? conversion.basisAmount
      : ingredient.grams_per_ml != null
        ? conversion.basisAmount * ingredient.grams_per_ml
        : null;

  return grams != null && grams > OIL_BULK_THRESHOLD_G;
}

// Edge Function calls occasionally fail at the network layer on mobile
// (a dropped WiFi/cellular hop, not an error the function itself
// returned) — surfaces as supabase-js's generic "Failed to send a
// request to Edge Function" with no real diagnostic value. One silent
// retry absorbs that class of transient blip before bothering the admin
// with an error for what's usually just a flaky connection.
async function withOneRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return await fn();
  }
}

function IngredientRowCard({
  item,
  allIngredients,
  onChange,
  onRemove,
  onResolve,
}: {
  item: PendingMealIngredient;
  allIngredients: IngredientRow[];
  onChange: (patch: Partial<PendingMealIngredient>) => void;
  onRemove: () => void;
  onResolve: (ingredient: IngredientRow) => void;
}) {
  const [usdaSearch, setUsdaSearch] = useState<UsdaSearchState | null>(null);
  const [creating, setCreating] = useState(false);
  const [aiEstimating, setAiEstimating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<AiIngredientEstimate | null>(null);
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [confirmPatch, setConfirmPatch] = useState<(Partial<IngredientRow> & { canonical_name: string }) | null>(null);
  // Two RN Modals presented at once (even briefly, mid-transition) can leave
  // an orphaned full-screen overlay that blocks all touches underneath — so
  // the edit sheet and confirm sheet are never both visible together. These
  // hold the handoff data until the sheet being closed actually finishes
  // its close animation (BottomSheet's onClosed), not just the instant its
  // `visible` prop flips.
  const [pendingConfirmPatch, setPendingConfirmPatch] = useState<(Partial<IngredientRow> & { canonical_name: string }) | null>(null);
  const [pendingReopenEdit, setPendingReopenEdit] = useState(false);
  const [confirmSaving, setConfirmSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [bridgeFixing, setBridgeFixing] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const confirmedBridgeUpdate = useConfirmedIngredientUpdate();

  const candidates = useMemo(
    () => (item.name.trim() ? matchIngredientCandidates(item.name, allIngredients) : []),
    [item.name, allIngredients],
  );

  const unitItems: DropdownItem[] = UNIT_OPTIONS.map((opt) => ({
    label: opt.label,
    onPress: () => onChange({ quantityUnit: opt.id }),
  }));

  // Per-100g macros of the candidate itself (not scaled to this meal's
  // quantity) — what actually lets an admin sanity-check "is this really
  // the same food", since scaled totals depend on a quantity that might
  // not even be filled in yet.
  const macroPreview = (calories: number | null, protein: number | null, carbohydrates: number | null, fat: number | null) => {
    const parts: string[] = [];
    if (calories != null) parts.push(`${calories.toFixed(0)} cal`);
    if (protein != null) parts.push(`${protein.toFixed(1)}g P`);
    if (carbohydrates != null) parts.push(`${carbohydrates.toFixed(1)}g C`);
    if (fat != null) parts.push(`${fat.toFixed(1)}g F`);
    return parts.length > 0 ? `${parts.join(" · ")} per 100g` : "no macro data";
  };

  // FNRI/USDA/Manual — same vocabulary as IngredientEditSheet's Source
  // field. This is the whole point of searching the local DB first: a
  // match already grounded to a real FNRI/USDA record is trustworthy in a
  // way a "manual" AI-estimated placeholder isn't, and the admin can't
  // tell the difference without this shown.
  const sourceLabel = (source: string | null) => source ?? "unverified";

  // What convertQuantityToBasis will actually use for a "piece"/"ml"
  // quantity, shown up front — the whole point being to see this BEFORE
  // picking a match or typing a quantity, not only after hitting a "can't
  // calculate" error.
  const bridgeLabel = (ingredient: IngredientRow): string | null => {
    const parts: string[] = [];
    if (ingredient.grams_per_piece != null) parts.push(`${ingredient.grams_per_piece}g per ${ingredient.piece_label ?? "piece"}`);
    if (ingredient.grams_per_ml != null) parts.push(`${ingredient.grams_per_ml}g/ml`);
    return parts.length > 0 ? parts.join(" · ") : null;
  };

  // Confidence label instead of a raw score — same HIGH/LOW vocabulary and
  // meaning as the USDA grounding panel/edit sheet, so an admin reading
  // this dropdown doesn't need a second mental scale.
  const candidateItems: DropdownItem[] = candidates.map(({ ingredient, confidence }) => ({
    label: `${ingredient.canonical_name} — ${confidence} confidence · ${sourceLabel(ingredient.source)}\n${macroPreview(ingredient.calories, ingredient.protein, ingredient.carbohydrates, ingredient.fat)}\n${bridgeLabel(ingredient) ?? "no piece/ml bridge set"}`,
    onPress: () => onResolve(ingredient),
  }));

  // The already-linked ingredient's own source, looked up from the full
  // list rather than stored on PendingMealIngredient — same reasoning as
  // above, so "Linked to X" still shows how trustworthy that link is.
  const linkedIngredient = item.ingredientId ? allIngredients.find((i) => i.id === item.ingredientId) : null;

  const contribution = computeItemContribution(item, allIngredients);
  // Only the two "no ... bridge set" reasons from convertQuantityToBasis
  // are actually fixable by estimating a bridge — an "unrecognized unit"
  // or "unrecognized basis_unit" error means something else is wrong
  // (wrong unit picked, bad basis_unit data) that an AI-suggested bridge
  // wouldn't address.
  const canSuggestBridge = contribution.status === "error" && contribution.reason.includes("bridge");
  // Which exact field convertQuantityToBasis's own error names — reusing
  // its wording rather than re-deriving from item.quantityUnit means this
  // always matches the SAME failure the admin is looking at right now,
  // not a separate guess that could disagree with it.
  const requiredBridge: "grams_per_ml" | "grams_per_piece" | undefined =
    contribution.status === "error"
      ? contribution.reason.includes("grams_per_piece")
        ? "grams_per_piece"
        : contribution.reason.includes("grams_per_ml")
          ? "grams_per_ml"
          : undefined
      : undefined;
  const oilHint = contribution.status === "ok" && bulkFryingOilHint(item, linkedIngredient);

  const useAbsorbedOilEstimate = () => {
    // Explicitly re-affirms ingredientId/ingredientName — a plain quantity
    // edit invalidates the current link (the parent's `update` treats a
    // changed qty as "might describe a different food now"), but this is
    // adjusting how much of the SAME already-correct ingredient counts,
    // not re-describing what it is. See `update` in the parent component.
    //
    // Preserves the ORIGINAL quantity as a price override before
    // overwriting quantityAmount/Unit with the absorbed estimate — the
    // cook still buys/uses the full amount poured (that's what price
    // should reflect), only the dish's macros reflect what's absorbed.
    onChange({
      quantityAmount: String(OIL_ABSORBED_SUGGESTION_G),
      quantityUnit: "g",
      note: "Used for frying — macros reflect ~14g absorbed; price still reflects the full amount used.",
      priceQuantityAmount: item.quantityAmount,
      priceQuantityUnit: item.quantityUnit,
      ingredientId: item.ingredientId,
      ingredientName: item.ingredientName,
    });
  };

  const clearPriceOverride = () => {
    onChange({
      priceQuantityAmount: "",
      priceQuantityUnit: "",
      ingredientId: item.ingredientId,
      ingredientName: item.ingredientName,
    });
  };

  // Reuses the same gap-fill mechanism handleAddAndUse already applies to
  // freshly-created USDA ingredients, just triggered reactively here once
  // a conversion has actually failed for a real, already-linked ingredient
  // — only fills whichever bridge field is still null, never touches an
  // already-set one. Requests the confirm-update sheet rather than writing
  // directly — this ingredient may already be used by OTHER, already-saved
  // meals, so the admin sees that blast radius before anything's written;
  // confirming is what actually runs the cascade (recomputeMealsUsingIngredient).
  const handleFixBridge = async () => {
    if (!linkedIngredient) return;
    setBridgeFixing(true);
    setBridgeError(null);
    try {
      const gaps = await withOneRetry(() => estimateIngredientGaps(linkedIngredient, requiredBridge));
      await confirmedBridgeUpdate.requestUpdate([
        { id: linkedIngredient.id, patch: gaps, name: linkedIngredient.canonical_name },
      ]);
    } catch (err) {
      setBridgeError(errorMessage(err));
    } finally {
      setBridgeFixing(false);
    }
  };

  const handleSearchUsda = async () => {
    setUsdaSearch({ loading: true, candidates: null, error: null });
    try {
      const [result] = await withOneRetry(() =>
        groundIngredientsUsda([{ id: item.key, canonicalName: item.name }]),
      );
      if (!result || result.confidence === "NONE") {
        setUsdaSearch({ loading: false, candidates: [], error: null });
      } else if (result.confidence === "ERROR") {
        setUsdaSearch({ loading: false, candidates: null, error: result.error });
      } else {
        setUsdaSearch({ loading: false, candidates: result.candidates, error: null });
      }
    } catch (err) {
      setUsdaSearch({ loading: false, candidates: null, error: errorMessage(err) });
    }
  };

  const handleAddAndUse = async (candidate: UsdaGroundingMatch) => {
    setCreating(true);
    setCreateError(null);
    try {
      const patch = applyUsdaMatch(candidate, "HIGH");
      const created = await createIngredient({
        canonical_name: item.name,
        role: "main",
        state: null,
        basis_amount: 100,
        basis_unit: "g",
        price_source: "manual",
        ...patch,
      });
      // USDA gives real nutrition but nothing operational (price, the
      // piece-count bridge) — an LLM fills exactly those gaps so this
      // ingredient never sits with a null price/bridge that silently
      // zeroes it out of a meal's totals. Best-effort: the ingredient is
      // already created and linked either way, but if the gap-fill call
      // fails, say so — silently falling back to bare defaults (role
      // hardcoded "main", no grams_per_ml/grams_per_piece) is exactly what
      // let garlic/onion powder sit mis-tagged as "main" with no bridge,
      // undetected, until a meal's totals came back wrong.
      try {
        const gaps = await estimateIngredientGaps(created);
        const filled = await updateIngredient(created.id, gaps);
        onResolve(filled);
      } catch (gapErr) {
        onResolve(created);
        setCreateError(
          `Added, but couldn't fill in price/role/unit details automatically (${gapErr instanceof Error ? gapErr.message : String(gapErr)}) — check "${item.name}" in Manage Ingredients before relying on this meal's totals.`,
        );
      }
      // A brand-new ingredient isn't in the cached matching list yet — without
      // this, its own contribution can't be looked up (allIngredients.find
      // comes up empty) and the price/macro box renders with nothing in it.
      await queryClient.invalidateQueries({ queryKey: ["admin", "meals"] });
      setUsdaSearch(null);
    } catch (err) {
      // Surfaced, not swallowed — an insert can fail (RLS, a constraint)
      // without onResolve ever running, which otherwise looks identical to
      // "nothing happened" with no indication whether it reached the DB.
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  // The admin's own call that nothing found so far (local DB or USDA) is a
  // real match: an LLM estimates a full draft row, the admin reviews/edits
  // every field in the same sheet used to edit real ingredients, then
  // confirms in a read-only summary before anything is written — never
  // auto-applied.
  const handleAiEstimate = async () => {
    setAiEstimating(true);
    setAiError(null);
    try {
      const draft = await withOneRetry(() => estimateIngredientAi(item.name));
      setAiDraft(draft);
      setEditSheetVisible(true);
    } catch (err) {
      setAiError(errorMessage(err));
    } finally {
      setAiEstimating(false);
    }
  };

  const handleConfirmCreate = async () => {
    if (!confirmPatch) return;
    setConfirmSaving(true);
    setCreateError(null);
    try {
      const created = await createIngredient(confirmPatch);
      onResolve(created);
      // Same reason as handleAddAndUse: a freshly-created ingredient isn't
      // in the cached matching list yet, so its contribution can't be
      // looked up without this — the price/macro box would render empty.
      await queryClient.invalidateQueries({ queryKey: ["admin", "meals"] });
      setConfirmPatch(null);
      setAiDraft(null);
    } catch (err) {
      // Keep the sheet open with the error visible rather than closing on
      // failure — same silent-failure risk as handleAddAndUse above.
      setCreateError(errorMessage(err));
    } finally {
      setConfirmSaving(false);
    }
  };

  return (
    <View className="gap-2 rounded-2xl border border-ink-emphasis/10 p-3">
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <TextField label="Ingredient name" value={item.name} onChangeText={(v) => onChange({ name: v })} />
        </View>
        <Pressable onPress={onRemove} className="h-9 w-9 items-center justify-center">
          <Trash2 color={colors.like} size={18} />
        </Pressable>
      </View>

      <View className="flex-row gap-2">
        <View className="flex-1">
          <TextField
            label="Qty amount"
            value={item.quantityAmount}
            onChangeText={(v) => onChange({ quantityAmount: v })}
            keyboardType="numeric"
          />
        </View>
        <View className="flex-1">
          <Dropdown
            trigger={<SelectField label="Unit" valueLabel={item.quantityUnit} />}
            items={unitItems}
            matchTriggerWidth
          />
        </View>
      </View>

      {item.ingredientId && (
        <View
          className={`rounded-xl border px-3 py-2 ${
            contribution.status === "error" ? "border-like/30 bg-like/5" : "border-primary/20 bg-primary/5"
          }`}
        >
          {contribution.status === "ok" && (
            <>
              <AppText variant="bodyBold" className="text-primary">
                {contributionLabel(contribution.totals)}
              </AppText>
              {item.priceQuantityAmount.trim() !== "" && (
                <View className="mt-1 flex-row items-center gap-2">
                  <AppText variant="caption" className="text-ink-subtle">
                    Price uses {item.priceQuantityAmount} {item.priceQuantityUnit} instead of the macro quantity
                  </AppText>
                  <Pressable onPress={clearPriceOverride}>
                    <AppText variant="caption" className="text-primary">
                      Clear
                    </AppText>
                  </Pressable>
                </View>
              )}
            </>
          )}
          {contribution.status === "error" && (
            <View className="gap-1.5">
              <AppText variant="caption" className="text-like">
                Can't calculate price/macros: {contribution.reason}
              </AppText>
              {canSuggestBridge && (
                <Pressable onPress={handleFixBridge} disabled={bridgeFixing} className="flex-row items-center gap-2 self-start">
                  {bridgeFixing && <ActivityIndicator size="small" color={colors.primary} />}
                  <AppText variant="caption" className="text-primary">
                    {bridgeFixing ? "Estimating..." : "Suggest bridge with AI"}
                  </AppText>
                </Pressable>
              )}
              {bridgeError && (
                <AppText variant="caption" className="text-like">
                  {bridgeError}
                </AppText>
              )}
            </View>
          )}
          {contribution.status === "no_quantity" && (
            <AppText variant="caption" className="text-ink-subtle">
              Set a quantity above to calculate price/macros
            </AppText>
          )}
          {/* Briefly hit right after a brand-new ingredient is created,
              before the matching list has refetched to include it — never
              leave this rendering nothing, even for that window. */}
          {contribution.status === "unlinked" && (
            <AppText variant="caption" className="text-ink-subtle">
              Refreshing...
            </AppText>
          )}
        </View>
      )}

      {oilHint && (
        <NoticeBanner icon={<Info color={colors.notice.icon} size={15} />}>
          <AppText variant="bodyBold" className="text-notice-text">
            Frying oil, not a direct addition
          </AppText>
          <AppText variant="caption" className="text-notice-text">
            Most of it stays in the pot — only ~14g (about 1 tbsp) typically gets absorbed.
          </AppText>
          <Pressable onPress={useAbsorbedOilEstimate} className="mt-1 self-start">
            <AppText variant="caption" className="text-primary">
              Use ~14g for macros, keep full amount for price
            </AppText>
          </Pressable>
        </NoticeBanner>
      )}

      <TextField
        label={'Display text (e.g. "3 cloves", "to taste")'}
        value={item.displayText}
        onChangeText={(v) => onChange({ displayText: v })}
      />

      <TextField
        label="Note (optional, shown to everyone)"
        value={item.note}
        onChangeText={(v) => onChange({ note: v })}
        multiline
      />

      <Dropdown
        trigger={
          <SelectField
            label="Ingredient database match"
            valueLabel={
              linkedIngredient
                ? `${linkedIngredient.canonical_name} (${sourceLabel(linkedIngredient.source)})`
                : candidates.length > 0
                  ? `${candidates.length} match(es) found`
                  : "No match — try Search USDA below"
            }
          />
        }
        items={candidateItems.length > 0 ? candidateItems : [{ label: "No matches yet", onPress: () => {} }]}
        matchTriggerWidth
      />

      {item.ingredientId ? (
        <View className="flex-row items-center gap-2">
          <Check color={colors.primary} size={14} />
          <AppText variant="caption" className="text-primary">
            Linked to {item.ingredientName}
            {linkedIngredient ? ` (${sourceLabel(linkedIngredient.source)})` : ""}
            {linkedIngredient ? ` · ${bridgeLabel(linkedIngredient) ?? "no piece/ml bridge set"}` : ""}
          </AppText>
        </View>
      ) : (
        <AppText variant="caption" className="text-like">
          Not yet linked to a real ingredient
        </AppText>
      )}

      {createError && (
        <AppText variant="caption" className="text-like">
          Couldn't add ingredient: {createError}
        </AppText>
      )}

      {usdaSearch?.candidates && usdaSearch.candidates.length > 0 ? (
        <Dropdown
          trigger={
            <SelectField
              label="USDA match"
              valueLabel={creating ? "Adding + filling in details..." : `${usdaSearch.candidates.length} result(s) — tap to add + use`}
              loading={creating}
            />
          }
          items={usdaSearch.candidates.map((c) => ({
            label: `${c.description} — ${classifyUsdaConfidence(c.score)} confidence\n${macroPreview(c.calories, c.protein, c.carbohydrates, c.fat)}`,
            onPress: () => handleAddAndUse(c),
          }))}
          matchTriggerWidth
        />
      ) : (
        <Pressable onPress={handleSearchUsda} disabled={usdaSearch?.loading} className="flex-row items-center gap-2">
          {usdaSearch?.loading && <ActivityIndicator size="small" color={colors.primary} />}
          <AppText variant="caption" className="text-primary">
            {usdaSearch?.loading ? "Searching USDA..." : "Search USDA"}
          </AppText>
        </Pressable>
      )}

      {usdaSearch?.error && (
        <AppText variant="caption" className="text-like">
          {usdaSearch.error}
        </AppText>
      )}
      {usdaSearch?.candidates?.length === 0 && (
        <AppText variant="caption" className="text-ink-subtle">
          No USDA match either — try adjusting the name.
        </AppText>
      )}

      {/* Always available, independent of USDA search state — this is the
          admin's own judgment call ("none of these actually match") to
          make at any point, not something gated behind a specific search
          result. */}
      <Pressable onPress={handleAiEstimate} disabled={aiEstimating} className="flex-row items-center gap-2">
        {aiEstimating && <ActivityIndicator size="small" color={colors.primary} />}
        <AppText variant="caption" className="text-primary">
          {aiEstimating ? "Estimating..." : "AI Estimate"}
        </AppText>
      </Pressable>
      {aiError && (
        <AppText variant="caption" className="text-like">
          {aiError}
        </AppText>
      )}

      <IngredientEditSheet
        visible={editSheetVisible}
        onClose={() => setEditSheetVisible(false)}
        ingredient={null}
        initialDraft={aiDraft}
        onSave={(patch) => {
          setCreateError(null);
          setPendingConfirmPatch({ ...patch, canonical_name: patch.canonical_name ?? item.name });
          setEditSheetVisible(false);
        }}
        onClosed={() => {
          if (pendingConfirmPatch) {
            setConfirmPatch(pendingConfirmPatch);
            setPendingConfirmPatch(null);
          }
        }}
        isSaving={false}
        saveLabel="Review"
      />

      <ConfirmIngredientSheet
        visible={!!confirmPatch}
        patch={confirmPatch}
        onCancel={() => {
          setPendingReopenEdit(true);
          setConfirmPatch(null);
        }}
        onClosed={() => {
          if (pendingReopenEdit) {
            setEditSheetVisible(true);
            setPendingReopenEdit(false);
          }
        }}
        onConfirm={handleConfirmCreate}
        isSaving={confirmSaving}
        error={createError}
      />

      <ConfirmIngredientUpdateSheet
        pending={confirmedBridgeUpdate.pending}
        affectedMeals={confirmedBridgeUpdate.affectedMeals}
        loading={confirmedBridgeUpdate.loadingAffected}
        isSaving={confirmedBridgeUpdate.isSaving}
        onConfirm={confirmedBridgeUpdate.confirm}
        onCancel={confirmedBridgeUpdate.cancel}
      />
    </View>
  );
}

type Props = {
  items: PendingMealIngredient[];
  allIngredients: IngredientRow[];
  onChange: (items: PendingMealIngredient[]) => void;
};

export function SeedMealIngredientsEditor({ items, allIngredients, onChange }: Props) {
  const update = (key: string, patch: Partial<PendingMealIngredient>) => {
    onChange(
      items.map((item) =>
        item.key === key
          ? {
              ...item,
              ...patch,
              // Editing the name/qty after a bind invalidates that bind —
              // the resolved ingredient may no longer be the right match.
              // Skipped when the patch itself explicitly re-affirms
              // ingredientId (e.g. the bulk-oil quick-action adjusting a
              // count without re-describing what the ingredient IS) —
              // undefined here means an ordinary manual edit that didn't
              // touch the link either way, so the invalidation still fires.
              ...(patch.ingredientId === undefined &&
              (patch.name !== undefined || patch.quantityAmount !== undefined || patch.quantityUnit !== undefined)
                ? { ingredientId: null, ingredientName: null }
                : {}),
            }
          : item,
      ),
    );
  };

  const resolve = (key: string, ingredient: IngredientRow) => {
    onChange(resolvePendingIngredient(items, key, ingredient));
  };

  const remove = (key: string) => onChange(items.filter((item) => item.key !== key));

  // Live running total — the exact same rule recomputeMealTotals applies
  // server-side (role='main' or category='Oils', a working quantity
  // conversion), computed here so the admin sees what saving will actually
  // produce WHILE still editing, not just after.
  const total = items.reduce(
    (acc, item) => {
      const c = computeItemContribution(item, allIngredients);
      if (c.status === "ok") {
        acc.price += c.totals.price ?? 0;
        acc.calories += c.totals.calories ?? 0;
        acc.protein += c.totals.protein ?? 0;
        acc.carbohydrates += c.totals.carbohydrates ?? 0;
        acc.fat += c.totals.fat ?? 0;
        acc.count += 1;
        const ingredient = allIngredients.find((i) => i.id === item.ingredientId);
        if (bulkFryingOilHint(item, ingredient)) acc.unreviewedOil += 1;
      }
      return acc;
    },
    { price: 0, calories: 0, protein: 0, carbohydrates: 0, fat: 0, count: 0, unreviewedOil: 0 },
  );

  return (
    <View className="gap-4">
      {items.map((item) => (
        <IngredientRowCard
          key={item.key}
          item={item}
          allIngredients={allIngredients}
          onChange={(patch) => update(item.key, patch)}
          onRemove={() => remove(item.key)}
          onResolve={(ingredient) => resolve(item.key, ingredient)}
        />
      ))}

      {total.count > 0 && (
        <View className="gap-1 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <AppText variant="caption" className="text-ink-subtle">
            Estimated total ({total.count} ingredient{total.count === 1 ? "" : "s"} counted)
          </AppText>
          <AppText variant="title" className="font-inter-semibold text-primary">
            ₱{total.price.toFixed(2)} · {Math.round(total.calories)} cal
          </AppText>
          <AppText variant="caption" className="text-ink-subtle">
            {total.protein.toFixed(1)}g protein · {total.carbohydrates.toFixed(1)}g carbs · {total.fat.toFixed(1)}g fat
          </AppText>
          {total.unreviewedOil > 0 && (
            <AppText variant="caption" className="text-notice-text">
              Includes {total.unreviewedOil} bulk-oil ingredient{total.unreviewedOil === 1 ? "" : "s"} not yet reviewed —
              see the highlighted row above.
            </AppText>
          )}
        </View>
      )}

      <Button label="+ Add ingredient" variant="outline" onPress={() => onChange([...items, newPendingIngredient()])} />
    </View>
  );
}
