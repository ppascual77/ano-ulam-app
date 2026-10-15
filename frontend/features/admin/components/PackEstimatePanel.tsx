import { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { AppText, Button, LoadingState } from "@/frontend/components/ui";
import {
  applyPackEstimate,
  buildPackEstimate,
  ingredientPricePerUnit,
  packEstimateOf,
  supermarketPriceOptions,
  PACK_ESTIMATE_MAX_PER_CALL,
  type AiPackSize,
  type IngredientRow,
} from "@/api/ingredients";
import { errorMessage } from "@/lib/errorMessage";
import { isLoose } from "@/frontend/core/grocery/utils/buildGroceryList";
import { useEstimatePackSizes, useIngredients } from "../hooks/useIngredients";
import { useConfirmedIngredientUpdate, type PendingIngredientChange } from "../hooks/useConfirmedIngredientUpdate";
import { ConfirmIngredientUpdateSheet } from "./ConfirmIngredientUpdateSheet";
import { Checkbox } from "./Checkbox";

// Dishes and water: never bought as a pack.
const EXCLUDED_CATEGORIES = new Set(["dessert", "street food", "water"]);
// Packaged-category items that are really bought loose, from the wet market
// or bakery, or made at home.
const NOT_PACKAGED = new Set([
  "atchara",
  "buro",
  "palapa",
  "taba ng talangka",
  "fermented fish paste",
  "shrimp paste, raw",
  "pandesal",
  "tofu, fried",
]);

// Packaged items the grocery list can't size a pack for: no store listing,
// but a price of their own to price the pack from. Cooked forms are skipped
// (you buy the dried beans, not cooked ones).
function needsPackEstimate(i: IngredientRow): boolean {
  const category = i.category?.trim().toLowerCase() ?? "";
  const name = i.canonical_name.trim().toLowerCase();
  return (
    !isLoose(i.category) &&
    !EXCLUDED_CATEGORIES.has(category) &&
    !NOT_PACKAGED.has(name) &&
    !/\bcooked\b/.test(name) &&
    supermarketPriceOptions(i.price_sources).length === 0 &&
    ingredientPricePerUnit(i) != null
  );
}

const describe = (pack: { packSize: number; packUnit: string; container: string }) =>
  `${pack.packSize} ${pack.packUnit} ${pack.container}`;

export function PackEstimatePanel() {
  const { data: ingredients, isLoading } = useIngredients({ showArchived: false });
  const candidates = useMemo(() => (ingredients ?? []).filter(needsPackEstimate), [ingredients]);
  const notEstimated = useMemo(() => candidates.filter((i) => !packEstimateOf(i.price_sources)), [candidates]);
  const [includeEstimated, setIncludeEstimated] = useState(false);
  const pool = includeEstimated ? candidates : notEstimated;

  const [results, setResults] = useState<AiPackSize[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [runError, setRunError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const estimate = useEstimatePackSizes();
  const confirmedUpdate = useConfirmedIngredientUpdate();

  const byId = useMemo(() => new Map((ingredients ?? []).map((i) => [i.id, i])), [ingredients]);

  // Skips rows already showing and awaiting review.
  const remaining = useMemo(() => {
    const shown = new Set(results.map((r) => r.id));
    return pool.filter((i) => !shown.has(i.id));
  }, [pool, results]);

  const handleRun = async () => {
    const batch = remaining.slice(0, PACK_ESTIMATE_MAX_PER_CALL);
    if (batch.length === 0) return;
    setRunError(null);
    try {
      const data = await estimate.mutateAsync(batch);
      setResults((prev) => [...prev, ...data]);
      // Pre-check every answer; errors (not sold in packs) stay unchecked.
      setSelected((prev) => {
        const next = new Set(prev);
        for (const r of data) if (!("error" in r)) next.add(r.id);
        return next;
      });
    } catch (err) {
      setRunError(errorMessage(err));
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRequestConfirm = async () => {
    setApplyError(null);
    const changes: PendingIngredientChange[] = [];
    for (const r of results) {
      const ingredient = byId.get(r.id);
      if (!selected.has(r.id) || "error" in r || !ingredient) continue;
      const entry = buildPackEstimate(ingredient, r);
      if (!entry) continue;
      changes.push({ id: r.id, patch: applyPackEstimate(ingredient, entry), name: ingredient.canonical_name });
    }
    await confirmedUpdate.requestUpdate(changes);
  };

  const handleConfirmApply = async () => {
    const applied = new Set(confirmedUpdate.pending?.map((c) => c.id) ?? []);
    try {
      await confirmedUpdate.confirm();
      setResults((prev) => prev.filter((r) => !applied.has(r.id)));
      setSelected(new Set());
    } catch (err) {
      confirmedUpdate.cancel();
      setApplyError(errorMessage(err));
    }
  };

  if (isLoading) return <LoadingState />;

  const errored = results.filter((r) => "error" in r).length;

  return (
    <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
      <AppText variant="body" className="text-ink-subtle mb-2">
        {notEstimated.length} packaged ingredient{notEstimated.length === 1 ? "" : "s"} with no store price and no
        pack estimate. AI picks each one&apos;s typical retail pack size; its price comes from the ingredient&apos;s own
        price, which never changes. Real store listings are never touched. Nothing is saved until you confirm.
      </AppText>

      {candidates.length > notEstimated.length && (
        <Pressable onPress={() => setIncludeEstimated((prev) => !prev)} className="flex-row items-center gap-3 mb-4">
          <Checkbox checked={includeEstimated} />
          <AppText variant="caption" className="text-ink-subtle flex-1">
            Also re-estimate {candidates.length - notEstimated.length} that already have one (replaces it)
          </AppText>
        </Pressable>
      )}

      <Button
        label={
          estimate.isPending
            ? "Estimating packs..."
            : `Estimate next ${Math.min(PACK_ESTIMATE_MAX_PER_CALL, remaining.length)} packs`
        }
        disabled={estimate.isPending || remaining.length === 0}
        onPress={handleRun}
      />

      {runError && (
        <AppText variant="body" className="text-like mt-3">
          Estimate failed: {runError}
        </AppText>
      )}

      {results.length > 0 && (
        <View className="mt-5 gap-2">
          <AppText variant="bodyBold" className="mb-2">
            {results.length - errored} estimated · {errored} not sold in packs
          </AppText>

          <Button
            label={`Confirm ${selected.size} ingredient${selected.size === 1 ? "" : "s"}`}
            loading={confirmedUpdate.isSaving}
            disabled={selected.size === 0}
            onPress={handleRequestConfirm}
          />
          {applyError && (
            <AppText variant="caption" className="text-like">
              {applyError}
            </AppText>
          )}

          {results.map((r) => {
            const ingredient = byId.get(r.id);
            if (!ingredient) return null;
            if ("error" in r) {
              return (
                <View key={r.id} className="border-b border-ink-emphasis/10 py-3 gap-1">
                  <AppText variant="bodyBold">{ingredient.canonical_name}</AppText>
                  <AppText variant="caption" className="text-ink-subtle">
                    {r.error}
                  </AppText>
                </View>
              );
            }
            const entry = buildPackEstimate(ingredient, r);
            const previous = packEstimateOf(ingredient.price_sources);
            return (
              <Pressable
                key={r.id}
                onPress={() => toggle(r.id)}
                className="flex-row items-start gap-3 border-b border-ink-emphasis/10 py-3"
              >
                <Checkbox checked={selected.has(r.id)} />
                <View className="flex-1 gap-0.5">
                  <AppText variant="bodyBold">{ingredient.canonical_name}</AppText>
                  {entry && (
                    <AppText variant="body">
                      Typically ~₱{Math.round(entry.packPrice)} per {describe(r)}
                    </AppText>
                  )}
                  <AppText variant="caption" className="text-ink-subtle">
                    {entry ? `At its ₱${Math.round(entry.pricePerUnit)}/${entry.unit}` : "No price to price it from"}
                    {r.example ? ` · e.g. ${r.example}` : ""}
                  </AppText>
                  {previous && (
                    <AppText variant="caption" className="text-accent">
                      Replaces {describe(previous)}
                    </AppText>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <ConfirmIngredientUpdateSheet
        pending={confirmedUpdate.pending}
        affectedMeals={confirmedUpdate.affectedMeals}
        loading={confirmedUpdate.loadingAffected}
        isSaving={confirmedUpdate.isSaving}
        onConfirm={handleConfirmApply}
        onCancel={confirmedUpdate.cancel}
      />
    </ScrollView>
  );
}
