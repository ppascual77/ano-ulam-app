import { useMemo, useState } from "react";
import { View, Pressable, Linking } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { Check, ExternalLink } from "lucide-react-native";
import { AppText, Button, LoadingState } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { applyUsdaMatch, getUsdaSourceUrl, type IngredientRow, type UsdaGroundingResult } from "@/api/ingredients";
import { useGroundIngredientsUsda, useIngredients, useUpdateIngredient } from "../hooks/useIngredients";

const CONFIDENCE_TONE: Record<string, string> = {
  HIGH: "text-primary",
  LOW: "text-accent",
  NONE: "text-ink-subtle",
  ERROR: "text-like",
};

export function UsdaGroundingPanel() {
  const { data: ingredients, isLoading } = useIngredients({ showArchived: false });
  // Only ingredients that haven't been through a real grounding pass yet —
  // never re-ground something already sourced from FNRI/USDA this way (use
  // the per-ingredient "Fetch from USDA" in Edit for a deliberate re-run).
  const groundingCandidates = useMemo(
    () => (ingredients ?? []).filter((i) => i.source === "manual" || i.source === null),
    [ingredients],
  );

  const [results, setResults] = useState<UsdaGroundingResult[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Which candidate (index into that result's `candidates` array) is
  // currently chosen per ingredient — defaults to 0 (the top/best-scoring
  // one), but ties on score (e.g. "Vinegar, balsamic" vs "Vinegar,
  // distilled" for a "Vinegar, white" query) mean the top pick isn't
  // always the right one, hence letting the admin switch it.
  const [candidateChoice, setCandidateChoice] = useState<Map<string, number>>(new Map());
  const ground = useGroundIngredientsUsda();
  const updateIngredient = useUpdateIngredient();
  const [applying, setApplying] = useState(false);

  const byId = useMemo(() => {
    const map = new Map<string, IngredientRow>();
    for (const i of ingredients ?? []) map.set(i.id, i);
    return map;
  }, [ingredients]);

  const handleRun = () => {
    ground.mutate(
      groundingCandidates.map((i) => ({ id: i.id, canonicalName: i.canonical_name })),
      {
        onSuccess: (data) => {
          setResults(data);
          setSelected(new Set(data.filter((r) => r.confidence === "HIGH").map((r) => r.id)));
          setCandidateChoice(new Map());
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

  const handleConfirm = async () => {
    if (!results) return;
    setApplying(true);
    try {
      for (const r of results) {
        if (!selected.has(r.id) || r.confidence === "NONE" || r.confidence === "ERROR") continue;
        const chosen = r.candidates[candidateChoice.get(r.id) ?? 0] ?? r.candidates[0];
        await updateIngredient.mutateAsync({ id: r.id, patch: applyUsdaMatch(chosen, r.confidence) });
      }
      setResults(null);
      setSelected(new Set());
      setCandidateChoice(new Map());
    } finally {
      setApplying(false);
    }
  };

  if (isLoading) return <LoadingState />;

  return (
    <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
      <AppText variant="body" className="text-ink-subtle mb-4">
        {groundingCandidates.length} ingredient{groundingCandidates.length === 1 ? "" : "s"} still manual
        (never grounded). Already USDA/FNRI-sourced ingredients are never re-ground here automatically —
        use "Fetch from USDA" in Edit for a deliberate one-off re-run.
      </AppText>

      <Button
        label={ground.isPending ? "Grounding..." : "Run USDA Grounding"}
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
            label={applying ? "Applying..." : `Confirm ${selected.size} selected`}
            disabled={applying || selected.size === 0}
            onPress={handleConfirm}
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
    </ScrollView>
  );
}
