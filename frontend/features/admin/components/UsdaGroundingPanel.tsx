import { useMemo, useState } from "react";
import { View, Pressable, Linking } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { Check, ExternalLink } from "lucide-react-native";
import { AppText, Button, LoadingState } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { applyUsdaMatch, getUsdaSourceUrl, type IngredientRow, type UsdaGroundingResult } from "@/api/ingredients";
import { useGroundIngredientsUsda, useIngredients, useMarkUsdaGroundingAttempted } from "../hooks/useIngredients";
import { useConfirmedIngredientUpdate, type PendingIngredientChange } from "../hooks/useConfirmedIngredientUpdate";
import { ConfirmIngredientUpdateSheet } from "./ConfirmIngredientUpdateSheet";

const CONFIDENCE_TONE: Record<string, string> = {
  HIGH: "text-primary",
  LOW: "text-accent",
  NONE: "text-ink-subtle",
  ERROR: "text-like",
};

export function UsdaGroundingPanel() {
  const { data: ingredients, isLoading } = useIngredients({ showArchived: false });
  // Ingredients still tagged manual — the pool a fresh batch seed lands in.
  // Never re-ground something already sourced from FNRI/USDA this way (use
  // the per-ingredient "Fetch from USDA" in Edit for a deliberate re-run).
  const manualIngredients = useMemo(
    () => (ingredients ?? []).filter((i) => i.source === "manual" || i.source === null),
    [ingredients],
  );
  // Of those, the ones never run through a grounding attempt at all —
  // `source` alone can't tell a freshly-seeded row apart from one that WAS
  // checked and stayed manual on purpose (no confident match, or a bad
  // match that got reverted). Without this split, every batch's default
  // run re-includes every previously-checked manual ingredient across the
  // whole table, forcing a re-review of the same items each time.
  const neverAttempted = useMemo(
    () => manualIngredients.filter((i) => !i.usda_last_attempted_at),
    [manualIngredients],
  );
  // Safety-net toggle: run against every manual ingredient regardless of
  // whether it's been checked before, in case something was missed.
  const [includeAlreadyChecked, setIncludeAlreadyChecked] = useState(false);
  const groundingCandidates = includeAlreadyChecked ? manualIngredients : neverAttempted;
  const alreadyCheckedCount = manualIngredients.length - neverAttempted.length;

  const [results, setResults] = useState<UsdaGroundingResult[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Which candidate (index into that result's `candidates` array) is
  // currently chosen per ingredient — defaults to 0 (the top/best-scoring
  // one), but ties on score (e.g. "Vinegar, balsamic" vs "Vinegar,
  // distilled" for a "Vinegar, white" query) mean the top pick isn't
  // always the right one, hence letting the admin switch it.
  const [candidateChoice, setCandidateChoice] = useState<Map<string, number>>(new Map());
  const ground = useGroundIngredientsUsda();
  const markAttempted = useMarkUsdaGroundingAttempted();
  const confirmedUpdate = useConfirmedIngredientUpdate();

  const byId = useMemo(() => {
    const map = new Map<string, IngredientRow>();
    for (const i of ingredients ?? []) map.set(i.id, i);
    return map;
  }, [ingredients]);

  const handleRun = () => {
    const batch = groundingCandidates;
    ground.mutate(
      batch.map((i) => ({ id: i.id, canonicalName: i.canonical_name })),
      {
        onSuccess: (data) => {
          setResults(data);
          setSelected(new Set(data.filter((r) => r.confidence === "HIGH").map((r) => r.id)));
          setCandidateChoice(new Map());
          // Mark every ingredient in this run as checked, regardless of
          // outcome — a NONE/ERROR/unticked result still means "we looked,
          // don't surface this by default next time." Applying a match
          // separately flips `source` off 'manual' anyway, so this is
          // mainly what keeps NONE/ERROR/skipped rows from resurfacing.
          markAttempted.mutate(batch.map((i) => i.id));
        },
      },
    );
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const chooseCandidate = (id: string, index: number) => {
    setCandidateChoice((prev) => new Map(prev).set(id, index));
  };

  // Previews the combined blast radius across every selected ingredient
  // before writing anything — see ConfirmIngredientUpdateSheet. Actually
  // applying (looping the writes, same as before) happens in
  // handleConfirmApply once the admin confirms.
  const handleRequestConfirm = async () => {
    if (!results) return;
    const changes: PendingIngredientChange[] = [];
    for (const r of results) {
      if (!selected.has(r.id) || r.confidence === "NONE" || r.confidence === "ERROR") continue;
      const chosen = r.candidates[candidateChoice.get(r.id) ?? 0] ?? r.candidates[0];
      changes.push({
        id: r.id,
        patch: applyUsdaMatch(chosen, r.confidence),
        name: byId.get(r.id)?.canonical_name ?? r.id,
      });
    }
    await confirmedUpdate.requestUpdate(changes);
  };

  const handleConfirmApply = async () => {
    await confirmedUpdate.confirm();
    setResults(null);
    setSelected(new Set());
    setCandidateChoice(new Map());
  };

  if (isLoading) return <LoadingState />;

  return (
    <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
      <AppText variant="body" className="text-ink-subtle mb-2">
        {neverAttempted.length} ingredient{neverAttempted.length === 1 ? "" : "s"} never checked against USDA.
        Already USDA/FNRI-sourced ingredients are never re-ground here automatically — use "Fetch from
        USDA" in Edit for a deliberate one-off re-run.
      </AppText>

      {alreadyCheckedCount > 0 && (
        <Pressable
          onPress={() => setIncludeAlreadyChecked((prev) => !prev)}
          className="flex-row items-center gap-3 mb-4"
        >
          <View
            className={`w-6 h-6 rounded-md items-center justify-center ${includeAlreadyChecked ? "bg-primary" : "border border-primary/20"}`}
          >
            {includeAlreadyChecked && <Check color={colors.white} size={14} />}
          </View>
          <AppText variant="caption" className="text-ink-subtle flex-1">
            Also include {alreadyCheckedCount} already-checked manual ingredient
            {alreadyCheckedCount === 1 ? "" : "s"} (safety net, in case something was missed)
          </AppText>
        </Pressable>
      )}

      <Button
        label={ground.isPending ? "Grounding..." : `Run USDA Grounding (${groundingCandidates.length})`}
        disabled={ground.isPending || groundingCandidates.length === 0}
        onPress={handleRun}
      />

      {ground.isError && (
        <AppText variant="body" className="text-like mt-3">
          Grounding failed: {String(ground.error)}
        </AppText>
      )}

      {results && (
        <View className="mt-5 gap-2">
          <AppText variant="bodyBold" className="mb-2">
            {results.filter((r) => r.confidence === "HIGH").length} high confidence ·{" "}
            {results.filter((r) => r.confidence === "LOW").length} low confidence ·{" "}
            {results.filter((r) => r.confidence === "NONE").length} no match ·{" "}
            {results.filter((r) => r.confidence === "ERROR").length} errored
          </AppText>

          <Button
            label={confirmedUpdate.isSaving ? "Applying..." : `Confirm ${selected.size} selected`}
            disabled={confirmedUpdate.isSaving || selected.size === 0}
            onPress={handleRequestConfirm}
          />

          {results.map((r) => {
            const ingredient = byId.get(r.id);
            const canSelect = r.confidence === "HIGH" || r.confidence === "LOW";
            const isSelected = selected.has(r.id);
            const activeIndex = candidateChoice.get(r.id) ?? 0;
            const activeCandidate = canSelect ? r.candidates[activeIndex] ?? r.candidates[0] : null;

            return (
              <View key={r.id} className="border-b border-ink-emphasis/10 py-3">
                <Pressable
                  onPress={() => canSelect && toggle(r.id)}
                  className="flex-row items-center gap-3"
                >
                  {canSelect && (
                    <View
                      className={`w-6 h-6 rounded-md items-center justify-center ${isSelected ? "bg-primary" : "border border-primary/20"}`}
                    >
                      {isSelected && <Check color={colors.white} size={14} />}
                    </View>
                  )}
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <AppText variant="bodyBold">{ingredient?.canonical_name ?? r.id}</AppText>
                      <AppText variant="caption" className={CONFIDENCE_TONE[r.confidence]}>
                        {r.confidence}
                      </AppText>
                    </View>
                    {r.confidence === "ERROR" && (
                      <AppText variant="caption" className="text-like">
                        {r.error}
                      </AppText>
                    )}
                    {r.confidence === "NONE" && (
                      <AppText variant="caption" className="text-ink-subtle">
                        No confident USDA match — resolve manually via Edit, or leave for FNRI.
                      </AppText>
                    )}
                    {activeCandidate && (
                      <Pressable
                        onPress={() => Linking.openURL(getUsdaSourceUrl(activeCandidate.fdcId))}
                        className="flex-row items-center gap-1"
                      >
                        <AppText variant="caption" className="text-ink-subtle">
                          → {activeCandidate.description} ({activeCandidate.calories ?? "?"} cal/100g)
                        </AppText>
                        <ExternalLink color={colors.ink.subtle} size={12} />
                      </Pressable>
                    )}
                  </View>
                </Pressable>

                {canSelect && r.candidates.length > 1 && (
                  <View className="flex-row flex-wrap gap-2 mt-2 ml-9">
                    {r.candidates.map((c, i) => (
                      <Pressable
                        key={c.fdcId}
                        onPress={() => chooseCandidate(r.id, i)}
                        className={`rounded-full px-3 py-1 border ${
                          i === activeIndex ? "border-primary bg-primary/10" : "border-ink-emphasis/10"
                        }`}
                      >
                        <AppText variant="caption" className={i === activeIndex ? "text-primary" : "text-ink-subtle"}>
                          {c.description}
                        </AppText>
                      </Pressable>
                    ))}
                  </View>
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
