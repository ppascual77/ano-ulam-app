import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { Check } from "lucide-react-native";
import { AppText, Button, LoadingState } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { applyFnriMatch, isMacrosVerified, type IngredientRow } from "@/api/ingredients";
import { useIngredients } from "../hooks/useIngredients";
import { useConfirmedIngredientUpdate, type PendingIngredientChange } from "../hooks/useConfirmedIngredientUpdate";
import { ConfirmIngredientUpdateSheet } from "./ConfirmIngredientUpdateSheet";
import { FNRI_FOODS, type FnriFood } from "../data/fnriFoods";

// Where each FNRI row stands against the live ingredients table.
type RowState =
  | "new" //       manual today: gets grounded for the first time
  | "upgrade" //   USDA today: FNRI is preferred for local foods
  | "applied" //   already FNRI-sourced, nothing to do
  | "verified" //  macros verified by the admin: locked, kept as they are
  | "missing"; //  no active ingredient by that name (renamed or archived)

const STATE_LABEL: Record<RowState, { label: string; tone: string }> = {
  new: { label: "Manual → FNRI", tone: "text-primary" },
  upgrade: { label: "USDA → FNRI", tone: "text-accent" },
  applied: { label: "Applied", tone: "text-ink-subtle" },
  verified: { label: "Verified, kept", tone: "text-ink-subtle" },
  missing: { label: "Ingredient not found", tone: "text-like" },
};

function stateOf(ingredient: IngredientRow | undefined): RowState {
  if (!ingredient) return "missing";
  if (ingredient.source === "FNRI") return "applied";
  if (isMacrosVerified(ingredient)) return "verified";
  return ingredient.source === "USDA" ? "upgrade" : "new";
}

const fmt = (v: number | null | undefined) => (v == null ? "–" : String(Math.round(v * 10) / 10));

// "kcal 105 → 108": current value then FNRI's, only where they differ.
function Diff({ label, from, to }: { label: string; from: number | null | undefined; to: number | null }) {
  const same = fmt(from) === fmt(to);
  return (
    <AppText variant="caption" className={same ? "text-ink-subtle" : "text-ink"}>
      {label} {same ? fmt(to) : `${fmt(from)} → ${fmt(to)}`}
    </AppText>
  );
}

// Applies the hand-curated PhilFCT values in data/fnriFoods.ts. No search or
// fuzzy matching: every row already names its exact ingredient, so this is a
// review-and-apply list. Nothing is written until the admin confirms (same
// confirm sheet as USDA grounding, which also shows the meals whose stored
// totals get recomputed).
export function FnriGroundingPanel() {
  const { data: ingredients, isLoading } = useIngredients({ showArchived: false });
  const confirmedUpdate = useConfirmedIngredientUpdate();

  const byName = useMemo(() => {
    const map = new Map<string, IngredientRow>();
    for (const i of ingredients ?? []) map.set(i.canonical_name, i);
    return map;
  }, [ingredients]);

  const rows = useMemo(
    () =>
      FNRI_FOODS.map((food) => {
        const ingredient = byName.get(food.ingredient);
        return { food, ingredient, state: stateOf(ingredient) };
      }),
    [byName],
  );
  const pendingRows = rows.filter((r) => r.state === "new" || r.state === "upgrade");

  // Everything still to apply starts ticked; re-tick after each apply.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelected(new Set(pendingRows.map((r) => r.food.ingredient)));
    // Only when the ingredient list itself changes (e.g. after applying).
  }, [ingredients]);

  const toggle = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const handleRequestConfirm = async () => {
    const changes: PendingIngredientChange[] = [];
    for (const r of pendingRows) {
      if (!r.ingredient || !selected.has(r.food.ingredient)) continue;
      changes.push({ id: r.ingredient.id, patch: applyFnriMatch(r.food), name: r.ingredient.canonical_name });
    }
    await confirmedUpdate.requestUpdate(changes);
  };

  if (isLoading) return <LoadingState />;

  const count = (state: RowState) => rows.filter((r) => r.state === state).length;
  const selectedCount = pendingRows.filter((r) => selected.has(r.food.ingredient)).length;

  return (
    <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
      <AppText variant="body" className="mb-2 text-ink-subtle">
        Philippine Food Composition Tables values, copied by hand from PhilFCT and matched to each ingredient
        (docs/fnri). Per 100 g edible portion; "–" means PhilFCT doesn&apos;t report it.
      </AppText>
      <AppText variant="bodyBold" className="mb-3">
        {count("new")} manual → FNRI · {count("upgrade")} USDA → FNRI · {count("applied")} applied
        {count("verified") > 0 ? ` · ${count("verified")} verified, kept` : ""}
        {count("missing") > 0 ? ` · ${count("missing")} not found` : ""}
      </AppText>

      <Button
        label={`Apply ${selectedCount} selected`}
        loading={confirmedUpdate.isSaving}
        disabled={selectedCount === 0}
        onPress={handleRequestConfirm}
      />

      <View className="mt-4">
        {rows.map(({ food, ingredient, state }) => (
          <FnriRow
            key={food.ingredient}
            food={food}
            ingredient={ingredient}
            state={state}
            selected={selected.has(food.ingredient)}
            onToggle={() => toggle(food.ingredient)}
          />
        ))}
      </View>

      <ConfirmIngredientUpdateSheet
        pending={confirmedUpdate.pending}
        affectedMeals={confirmedUpdate.affectedMeals}
        loading={confirmedUpdate.loadingAffected}
        isSaving={confirmedUpdate.isSaving}
        onConfirm={confirmedUpdate.confirm}
        onCancel={confirmedUpdate.cancel}
      />
    </ScrollView>
  );
}

type FnriRowProps = {
  food: FnriFood;
  ingredient: IngredientRow | undefined;
  state: RowState;
  selected: boolean;
  onToggle: () => void;
};

function FnriRow({ food, ingredient, state, selected, onToggle }: FnriRowProps) {
  const canSelect = state === "new" || state === "upgrade";
  const { label, tone } = STATE_LABEL[state];
  return (
    <Pressable onPress={() => canSelect && onToggle()} className="flex-row gap-3 border-b border-ink-emphasis/10 py-3">
      <View className="w-6 pt-0.5">
        {canSelect && (
          <View className={`h-6 w-6 items-center justify-center rounded-md ${selected ? "bg-primary" : "border border-primary/20"}`}>
            {selected && <Check color={colors.white} size={14} />}
          </View>
        )}
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row flex-wrap items-center gap-2">
          <AppText variant="bodyBold">{food.ingredient}</AppText>
          <AppText variant="caption" className={tone}>
            {label}
          </AppText>
        </View>
        <AppText variant="caption" className="text-ink-subtle">
          PhilFCT: {food.fnriName ?? "(name not copied)"}
        </AppText>
        {state !== "missing" && (
          <View className="flex-row flex-wrap gap-x-3">
            <Diff label="kcal" from={ingredient?.calories} to={food.calories} />
            <Diff label="P" from={ingredient?.protein} to={food.protein} />
            <Diff label="C" from={ingredient?.carbohydrates} to={food.carbohydrates} />
            <Diff label="F" from={ingredient?.fat} to={food.fat} />
            <Diff label="fiber" from={ingredient?.fiber} to={food.fiber} />
            <Diff label="sugar" from={ingredient?.sugar} to={food.sugar} />
            <Diff label="Na" from={ingredient?.sodium} to={food.sodium} />
          </View>
        )}
      </View>
    </Pressable>
  );
}
