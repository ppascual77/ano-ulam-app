import { useMemo, useState } from "react";
import { View, Pressable, Linking } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { ExternalLink } from "lucide-react-native";
import { AppText, Button, LoadingState } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import {
  applyPriceMatch,
  cheapestPriceOption,
  supermarketPriceOptions,
  PRICE_GROUNDING_MAX_PER_CALL,
  type IngredientRow,
  type PriceGroundingCandidate,
  type PriceGroundingResult,
  type PriceOption,
} from "@/api/ingredients";
import { commoditiesByIngredient, daPriceOption, linkedDaPrices } from "@/api/daPrices";
import { errorMessage } from "@/lib/errorMessage";
import { useGroundIngredientPrices, useIngredients, useMarkPriceGroundingAttempted } from "../hooks/useIngredients";
import { useDaCommodities } from "../hooks/useDaPrices";
import { useConfirmedIngredientUpdate, type PendingIngredientChange } from "../hooks/useConfirmedIngredientUpdate";
import { ConfirmIngredientUpdateSheet } from "./ConfirmIngredientUpdateSheet";
import { Checkbox } from "./Checkbox";

// Each lookup is paid (one or more web searches), so runs are capped rather
// than "check all ~500": the admin sees real cost and quality on a small
// batch before committing to more. 5 while measuring token cost (a run of
// 25 cost ~$2 before the search cap); raise once per-ingredient cost is known.
const RUN_SIZE = 5;
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
  // Ingredient id → indexes of its checked candidates (sources). The price
  // written is the cheapest of the checked sources (and the linked DA price).
  const [selected, setSelected] = useState<Map<string, Set<number>>>(new Map());
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  // Real OpenAI spend this session, summed from each lookup's reported usage.
  // Kept separately from `results` so it still counts rows already applied.
  const [spend, setSpend] = useState({ lookups: 0, searchCalls: 0, costUsd: 0 });
  const [applyError, setApplyError] = useState<string | null>(null);
  const ground = useGroundIngredientPrices();
  const markAttempted = useMarkPriceGroundingAttempted();
  const confirmedUpdate = useConfirmedIngredientUpdate();

  const byId = useMemo(() => {
    const map = new Map<string, IngredientRow>();
    for (const i of ingredients ?? []) map.set(i.id, i);
    return map;
  }, [ingredients]);

  // Linked DA commodities: their prices stay among the ingredient's
  // sources, so a cheaper DA price isn't overwritten by a supermarket one.
  const { data: daCommodities } = useDaCommodities();
  const daByIngredient = useMemo(() => commoditiesByIngredient(daCommodities ?? []), [daCommodities]);
  const daOptionsFor = (ingredient: IngredientRow | undefined): PriceOption[] => {
    if (!ingredient) return [];
    return linkedDaPrices(daByIngredient.get(ingredient.id) ?? []).flatMap(
      ({ commodity, price }) => daPriceOption(commodity, price, ingredient) ?? [],
    );
  };

  const handleRun = async () => {
    // Skip rows already showing and awaiting review, so "already checked"
    // mode doesn't re-search them. ERROR rows (e.g. rate-limited) aren't
    // skipped: the next run retries them first, since they're still at the
    // front of the never-checked pool.
    const shown = new Set(results.filter((r) => r.confidence !== "ERROR").map((r) => r.id));
    const batch = pool.filter((i) => !shown.has(i.id)).slice(0, RUN_SIZE);
    if (batch.length === 0) return;

    setRunError(null);
    setRunning({ done: 0, total: batch.length });
    // One chunk at a time, not in parallel: parallel chunks hit gpt-5-mini's
    // per-minute rate limit. Results still land per chunk, so the first ones
    // are reviewable while the rest are searching.
    for (const part of chunk(batch, PRICE_GROUNDING_MAX_PER_CALL)) {
      try {
        const data = await ground.mutateAsync(part);
        const ids = new Set(data.map((r) => r.id));
        // Replace an earlier ERROR row for the same ingredient with its retry.
        setResults((prev) => [...prev.filter((r) => !ids.has(r.id)), ...data]);
        setSpend((prev) =>
          data.reduce(
            (acc, r) =>
              r.usage
                ? {
                    lookups: acc.lookups + 1,
                    searchCalls: acc.searchCalls + r.usage.searchCalls,
                    costUsd: acc.costUsd + r.usage.costUsd,
                  }
                : acc,
            prev,
          ),
        );
        // Pre-check every HIGH source; LOW ones are opt-in.
        setSelected((prev) => {
          const next = new Map(prev);
          for (const r of data) {
            if (r.confidence !== "HIGH" && r.confidence !== "LOW") continue;
            const high = (r.candidates ?? []).flatMap((c, i) => (c.confidence === "HIGH" ? [i] : []));
            if (high.length > 0) next.set(r.id, new Set(high));
          }
          return next;
        });
        // NONE counts as checked (same as USDA grounding: don't resurface it
        // by default). ERROR doesn't: a rate limit or timeout says nothing
        // about the ingredient, so it stays in the pool for the next run.
        markAttempted.mutate(data.filter((r) => r.confidence !== "ERROR").map((r) => r.id));
      } catch (err) {
        setRunError(errorMessage(err));
      } finally {
        setRunning((prev) => (prev ? { ...prev, done: prev.done + part.length } : prev));
      }
    }
    setRunning(null);
  };

  const toggle = (id: string, index: number) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const indexes = new Set(next.get(id));
      if (indexes.has(index)) indexes.delete(index);
      else indexes.add(index);
      if (indexes.size === 0) next.delete(id);
      else next.set(id, indexes);
      return next;
    });
  };

  const checkedCandidates = (r: PriceGroundingResult): PriceGroundingCandidate[] => {
    if (r.confidence !== "HIGH" && r.confidence !== "LOW") return [];
    const indexes = selected.get(r.id);
    return indexes ? (r.candidates ?? []).filter((_, i) => indexes.has(i)) : [];
  };

  const handleRequestConfirm = async () => {
    setApplyError(null);
    const changes: PendingIngredientChange[] = [];
    for (const r of results) {
      const picked = checkedCandidates(r);
      const ingredient = byId.get(r.id);
      if (picked.length === 0 || !ingredient) continue;
      changes.push({
        id: r.id,
        patch: applyPriceMatch(ingredient, picked, daOptionsFor(ingredient)),
        name: ingredient.canonical_name,
      });
    }
    await confirmedUpdate.requestUpdate(changes);
  };

  const handleConfirmApply = async () => {
    const applied = new Set(confirmedUpdate.pending?.map((c) => c.id) ?? []);
    try {
      await confirmedUpdate.confirm();
      // Drop only what was written; unselected LOW/NONE rows stay for review.
      setResults((prev) => prev.filter((r) => !applied.has(r.id)));
      setSelected(new Map());
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
        searches only these supermarkets' online stores: SM Markets, GoRobinsons, WalterMart, MetroMart, Landers,
        and S&R. It is a paid web search; the real cost of each run shows below. Nothing is saved until you confirm.
      </AppText>

      {alreadyCheckedCount > 0 && (
        <Pressable onPress={() => setIncludeAlreadyChecked((prev) => !prev)} className="flex-row items-center gap-3 mb-4">
          <Checkbox checked={includeAlreadyChecked} />
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

      {spend.lookups > 0 && (
        <AppText variant="caption" className="text-ink-subtle mt-2">
          This session: {spend.lookups} lookup{spend.lookups === 1 ? "" : "s"} · {spend.searchCalls} web search
          {spend.searchCalls === 1 ? "" : "es"} · ~${spend.costUsd.toFixed(2)} (~$
          {(spend.costUsd / spend.lookups).toFixed(3)} per ingredient)
        </AppText>
      )}

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
            label={confirmedUpdate.isSaving ? "Applying..." : `Confirm ${selected.size} ingredient${selected.size === 1 ? "" : "s"}`}
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
            // `?? []`: an older deployed function returns `candidate` (singular);
            // show nothing for that row rather than crash.
            const candidates = r.confidence === "HIGH" || r.confidence === "LOW" ? r.candidates ?? [] : [];
            const picked = checkedCandidates(r);
            const current = currentPricePerUnit(ingredient);
            // Preview what would be written: the cheapest of the checked
            // sources and the linked DA price, or the best source while
            // nothing is checked.
            const best = cheapestPriceOption([
              ...supermarketPriceOptions(picked.length > 0 ? picked : candidates.slice(0, 1)),
              ...daOptionsFor(ingredient),
            ]);
            const preview = best?.pricePerUnit ?? null;
            const unit = best?.unit;
            const ratio = preview != null && current ? preview / current : null;
            const isBigChange = ratio != null && (ratio > BIG_CHANGE_RATIO || ratio < 1 / BIG_CHANGE_RATIO);

            return (
              <View key={r.id} className="border-b border-ink-emphasis/10 py-3 gap-1">
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

                {preview != null && unit && (
                  <AppText variant="body">
                    {current != null ? `₱${Math.round(current)}/${unit}` : "No price"} → ₱{Math.round(preview)}/{unit}
                    {ratio != null && ` (${ratio >= 1 ? "+" : ""}${Math.round((ratio - 1) * 100)}%)`}
                    {best?.source === "da" && " · DA is cheaper"}
                    {picked.length === 0 && " · nothing selected"}
                  </AppText>
                )}

                {candidates.map((c, i) => (
                  <Pressable key={c.url} onPress={() => toggle(r.id, i)} className="flex-row items-start gap-3 mt-1">
                    <Checkbox checked={!!selected.get(r.id)?.has(i)} />
                    <View className="flex-1 gap-0.5">
                      <AppText variant="body">
                        {c.store} · ₱{Math.round(c.pricePerUnit)}/{c.unit}{" "}
                        <AppText variant="caption" className={CONFIDENCE_TONE[c.confidence]}>
                          {c.confidence}
                        </AppText>
                      </AppText>
                      <Pressable onPress={() => Linking.openURL(c.url)} className="flex-row items-center gap-1">
                        <AppText variant="caption" className="text-ink-subtle flex-shrink">
                          {c.productTitle} · ₱{c.packPrice} / {c.packSize}
                          {c.packUnit === "piece" ? " pc" : c.packUnit}
                        </AppText>
                        <ExternalLink color={colors.ink.subtle} size={12} />
                      </Pressable>
                      {c.reasons.map((reason, j) => (
                        <AppText key={j} variant="caption" className="text-accent">
                          {reason}
                        </AppText>
                      ))}
                    </View>
                  </Pressable>
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
