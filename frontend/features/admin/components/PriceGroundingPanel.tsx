import { useMemo, useState } from "react";
import { View, Pressable, Linking } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { Check, ExternalLink } from "lucide-react-native";
import { AppText, Button, LoadingState } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import {
  applyPriceMatch,
  PRICE_GROUNDING_MAX_PER_CALL,
  type IngredientRow,
  type PriceGroundingResult,
} from "@/api/ingredients";
import { errorMessage } from "@/lib/errorMessage";
import { useGroundIngredientPrices, useIngredients, useMarkPriceGroundingAttempted } from "../hooks/useIngredients";
import { useConfirmedIngredientUpdate, type PendingIngredientChange } from "../hooks/useConfirmedIngredientUpdate";
import { ConfirmIngredientUpdateSheet } from "./ConfirmIngredientUpdateSheet";

// One run = one paid web search per ingredient, so runs are capped rather
// than "check all ~500": the admin sees real cost and quality on a small
// batch before committing to more.
const RUN_SIZE = 25;
// A found price this far off the current one (either direction) is worth a
// second look before accepting, e.g. a per-piece price read as per-kg.
const BIG_CHANGE_RATIO = 3;

const CONFIDENCE_TONE: Record<string, string> = {
  HIGH: "text-primary",
  LOW: "text-accent",
  NONE: "text-ink-subtle",
  ERROR: "text-like",
};

// Current price expressed in the candidate's kg/L unit, so the two compare
// directly ("₱0.16/g" vs "₱238/kg" isn't readable at a glance).
function currentPricePerUnit(ingredient: IngredientRow | undefined): number | null {
  if (!ingredient || ingredient.estimated_price == null) return null;
  const unit = ingredient.estimated_price_unit;
  if (unit === "g" || unit === "ml") return ingredient.estimated_price * 1000;
  if (unit === "kg" || unit === "L") return ingredient.estimated_price;
  return null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function PriceGroundingPanel() {
  const { data: ingredients, isLoading } = useIngredients({ showArchived: false });
  const neverChecked = useMemo(
    () => (ingredients ?? []).filter((i) => !i.price_last_attempted_at),
    [ingredients],
  );
  const [includeAlreadyChecked, setIncludeAlreadyChecked] = useState(false);
  const pool = includeAlreadyChecked ? ingredients ?? [] : neverChecked;
  const alreadyCheckedCount = (ingredients?.length ?? 0) - neverChecked.length;

  const [results, setResults] = useState<PriceGroundingResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const ground = useGroundIngredientPrices();
  const markAttempted = useMarkPriceGroundingAttempted();
  const confirmedUpdate = useConfirmedIngredientUpdate();

  const byId = useMemo(() => {
    const map = new Map<string, IngredientRow>();
    for (const i of ingredients ?? []) map.set(i.id, i);
    return map;
  }, [ingredients]);

  const handleRun = async () => {
    // Skip anything already showing in the results list, so "already
    // checked" mode doesn't re-search rows still awaiting review.
    const shown = new Set(results.map((r) => r.id));
    const batch = pool.filter((i) => !shown.has(i.id)).slice(0, RUN_SIZE);
    if (batch.length === 0) return;

    setRunError(null);
    setRunning({ done: 0, total: batch.length });
    // Chunks run in parallel and land as they finish, so the first results
    // are reviewable while the rest are still searching.
    await Promise.all(
      chunk(batch, PRICE_GROUNDING_MAX_PER_CALL).map(async (part) => {
        try {
          const data = await ground.mutateAsync(part);
          setResults((prev) => [...prev, ...data]);
          setSelected((prev) => {
            const next = new Set(prev);
            for (const r of data) if (r.confidence === "HIGH") next.add(r.id);
            return next;
          });
          // Checked regardless of outcome, same as USDA grounding — NONE/
          // ERROR rows shouldn't resurface in the default pool next run.
          markAttempted.mutate(part.map((i) => i.id));
        } catch (err) {
          setRunError(errorMessage(err));
        } finally {
          setRunning((prev) => (prev ? { ...prev, done: prev.done + part.length } : prev));
        }
      }),
    );
    setRunning(null);
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
      if (!selected.has(r.id) || (r.confidence !== "HIGH" && r.confidence !== "LOW")) continue;
      changes.push({ id: r.id, patch: applyPriceMatch(r.candidate), name: byId.get(r.id)?.canonical_name ?? r.id });
    }
    await confirmedUpdate.requestUpdate(changes);
  };

  const handleConfirmApply = async () => {
    const applied = new Set(confirmedUpdate.pending?.map((c) => c.id) ?? []);
    try {
      await confirmedUpdate.confirm();
      // Drop only what was written; unselected LOW/NONE rows stay for review.
      setResults((prev) => prev.filter((r) => !applied.has(r.id)));
      setSelected(new Set());
    } catch (err) {
      confirmedUpdate.cancel();
      setApplyError(errorMessage(err));
    }
  };

  if (isLoading) return <LoadingState />;

  const counts = {
    HIGH: results.filter((r) => r.confidence === "HIGH").length,
    LOW: results.filter((r) => r.confidence === "LOW").length,
    NONE: results.filter((r) => r.confidence === "NONE").length,
    ERROR: results.filter((r) => r.confidence === "ERROR").length,
  };

  return (
    <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
      <AppText variant="body" className="text-ink-subtle mb-2">
        {neverChecked.length} ingredient{neverChecked.length === 1 ? "" : "s"} never price-checked. Each check
        searches only these supermarkets' online stores: SM Markets, Puregold, GoRobinsons, WalterMart, MetroMart,
        Landers, and S&R. It is a paid web search, about
        2–3¢ USD per ingredient. Nothing is saved until you confirm.
      </AppText>

      {alreadyCheckedCount > 0 && (
        <Pressable onPress={() => setIncludeAlreadyChecked((prev) => !prev)} className="flex-row items-center gap-3 mb-4">
          <View
            className={`w-6 h-6 rounded-md items-center justify-center ${includeAlreadyChecked ? "bg-primary" : "border border-primary/20"}`}
          >
            {includeAlreadyChecked && <Check color={colors.white} size={14} />}
          </View>
          <AppText variant="caption" className="text-ink-subtle flex-1">
            Also include {alreadyCheckedCount} already-checked ingredient{alreadyCheckedCount === 1 ? "" : "s"} (to
            refresh old prices)
          </AppText>
        </Pressable>
      )}

      <Button
        label={
          running
            ? `Checking prices... ${running.done}/${running.total}`
            : `Check next ${Math.min(RUN_SIZE, pool.length)} prices`
        }
        disabled={!!running || pool.length === 0}
        onPress={handleRun}
      />

      {runError && (
        <AppText variant="body" className="text-like mt-3">
          Price check failed: {runError}
        </AppText>
      )}

      {results.length > 0 && (
        <View className="mt-5 gap-2">
          <AppText variant="bodyBold" className="mb-2">
            {counts.HIGH} high confidence · {counts.LOW} low confidence · {counts.NONE} not found · {counts.ERROR}{" "}
            errored
          </AppText>

          <Button
            label={confirmedUpdate.isSaving ? "Applying..." : `Confirm ${selected.size} selected`}
            disabled={confirmedUpdate.isSaving || selected.size === 0}
            onPress={handleRequestConfirm}
          />
          {applyError && (
            <AppText variant="caption" className="text-like">
              {applyError}
            </AppText>
          )}

          {results.map((r) => {
            const ingredient = byId.get(r.id);
            const canSelect = r.confidence === "HIGH" || r.confidence === "LOW";
            const isSelected = selected.has(r.id);
            const current = currentPricePerUnit(ingredient);
            const found = canSelect ? r.candidate : null;
            const ratio = found && current ? found.pricePerUnit / current : null;
            const isBigChange = ratio != null && (ratio > BIG_CHANGE_RATIO || ratio < 1 / BIG_CHANGE_RATIO);

            return (
              <View key={r.id} className="border-b border-ink-emphasis/10 py-3">
                <Pressable onPress={() => canSelect && toggle(r.id)} className="flex-row items-start gap-3">
                  {canSelect && (
                    <View
                      className={`w-6 h-6 mt-0.5 rounded-md items-center justify-center ${isSelected ? "bg-primary" : "border border-primary/20"}`}
                    >
                      {isSelected && <Check color={colors.white} size={14} />}
                    </View>
                  )}
                  <View className="flex-1 gap-0.5">
                    <View className="flex-row items-center flex-wrap gap-2">
                      <AppText variant="bodyBold">{ingredient?.canonical_name ?? r.id}</AppText>
                      <AppText variant="caption" className={CONFIDENCE_TONE[r.confidence]}>
                        {r.confidence}
                      </AppText>
                      {isBigChange && (
                        <View className="rounded-full px-2 py-0.5 border border-notice-border bg-notice-bg">
                          <AppText variant="caption" className="text-notice-text">
                            Big change, double-check
                          </AppText>
                        </View>
                      )}
                    </View>

                    {found && (
                      <>
                        <AppText variant="body">
                          {current != null ? `₱${Math.round(current)}/${found.unit}` : "No price"} → ₱
                          {Math.round(found.pricePerUnit)}/{found.unit}
                          {ratio != null && ` (${ratio >= 1 ? "+" : ""}${Math.round((ratio - 1) * 100)}%)`}
                        </AppText>
                        <Pressable onPress={() => Linking.openURL(found.url)} className="flex-row items-center gap-1">
                          <AppText variant="caption" className="text-ink-subtle flex-shrink">
                            {found.store} · {found.productTitle} · ₱{found.packPrice} / {found.packSize}
                            {found.packUnit === "piece" ? " pc" : found.packUnit}
                          </AppText>
                          <ExternalLink color={colors.ink.subtle} size={12} />
                        </Pressable>
                      </>
                    )}
                    {canSelect &&
                      r.reasons.map((reason, i) => (
                        <AppText key={i} variant="caption" className="text-accent">
                          {reason}
                        </AppText>
                      ))}
                    {r.confidence === "NONE" && (
                      <AppText variant="caption" className="text-ink-subtle">
                        {r.reason}
                      </AppText>
                    )}
                    {r.confidence === "ERROR" && (
                      <AppText variant="caption" className="text-like">
                        {r.error}
                      </AppText>
                    )}
                  </View>
                </Pressable>
              </View>
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
