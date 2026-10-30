import { useMemo, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { ExternalLink } from "lucide-react-native";
import { AppText, Button, LoadingState } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { applyUsdaMatch, getUsdaSourceUrl, isMacrosVerified, type IngredientRow, type UsdaGroundingResult } from "@/api/ingredients";
import { useGroundIngredientsUsda, useIngredients, useMarkUsdaGroundingAttempted } from "../hooks/useIngredients";
import { useConfirmedIngredientUpdate, type PendingIngredientChange } from "../hooks/useConfirmedIngredientUpdate";
import { ConfirmIngredientUpdateSheet } from "./ConfirmIngredientUpdateSheet";
import { ConfidenceChip, InlineError, SelectBox, StatTiles } from "./AdminUi";

export function UsdaGroundingPanel() {
  const { data: ingredients, isLoading } = useIngredients({ showArchived: false });
  // Ingredients still tagged manual — the pool a fresh batch seed lands in.
  // Never re-ground something already sourced from FNRI/USDA this way (use
  // the per-ingredient "Fetch from USDA" in Edit for a deliberate re-run).
  // Verified macros are locked, so an approved estimate stays out too.
  const manualIngredients = useMemo(
    () => (ingredients ?? []).filter((i) => (i.source === "manual" || i.source === null) && !isMacrosVerified(i)),
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
          // Mark what USDA actually answered as checked (a match, NONE, or
          // an unticked result means "we looked, don't surface this by
          // default next time"). Not ERROR: that's usually USDA's rate
          // limit, not "USDA has nothing", and marking it buried ~200
          // ingredients as checked that were never really looked up.
          markAttempted.mutate(data.filter((r) => r.confidence !== "ERROR").map((r) => r.id));
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
      <View className="mb-4 gap-1">
        <AppText variant="sectionSubtitle" dot>
          Ground from USDA
        </AppText>
        <Text className="font-inter-regular text-body-lg text-ink">
          <Text className="font-inter-semibold">
            {neverAttempted.length} ingredient{neverAttempted.length === 1 ? "" : "s"}
          </Text>{" "}
          never checked against USDA. Already USDA/FNRI-sourced ingredients are never re-ground here automatically —
          use "Fetch from USDA" in Edit for a deliberate one-off re-run.
        </Text>
      </View>

      {alreadyCheckedCount > 0 && (
        <Pressable
          onPress={() => setIncludeAlreadyChecked((prev) => !prev)}
          className="flex-row items-center gap-3 mb-4"
        >
          <SelectBox checked={includeAlreadyChecked} />
          <AppText variant="caption" className="flex-1 text-ink">
            Also include {alreadyCheckedCount} already-checked manual ingredient
            {alreadyCheckedCount === 1 ? "" : "s"} (safety net, in case something was missed)
          </AppText>
        </Pressable>
      )}

      <Button
        label={`Run USDA Grounding (${groundingCandidates.length})`}
        loading={ground.isPending}
        disabled={groundingCandidates.length === 0}
        onPress={handleRun}
      />

      {ground.isError && (
        <View className="mt-3">
          <InlineError>Grounding failed: {String(ground.error)}</InlineError>
        </View>
      )}

      {results && (
        <View className="mt-6 gap-3 border-t border-ink-emphasis/10 pt-6">
          <AppText variant="sectionSubtitle" dot>
            Results
          </AppText>
          <View className="rounded-2xl bg-primary/5 p-2">
            <StatTiles
              stats={[
                { label: "High", value: String(results.filter((r) => r.confidence === "HIGH").length), emphasis: true },
                { label: "Low", value: String(results.filter((r) => r.confidence === "LOW").length) },
                { label: "No match", value: String(results.filter((r) => r.confidence === "NONE").length) },
                { label: "Errored", value: String(results.filter((r) => r.confidence === "ERROR").length) },
              ]}
            />
          </View>

          <Button
            label={`Confirm ${selected.size} selected`}
            loading={confirmedUpdate.isSaving}
            disabled={selected.size === 0}
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
                  {canSelect && <SelectBox checked={isSelected} />}
                  <View className="flex-1 gap-1">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="font-inter-semibold text-body-lg text-ink-emphasis">{ingredient?.canonical_name ?? r.id}</Text>
                      <ConfidenceChip confidence={r.confidence} />
                    </View>
                    {r.confidence === "ERROR" && <InlineError>{r.error}</InlineError>}
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
                        <AppText variant="caption" className="text-ink">
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
