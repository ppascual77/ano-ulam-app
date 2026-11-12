import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Check, ChevronDown, Plus, X } from "lucide-react-native";
import { AppText, Card, Dropdown, useFieldErrorAnimation } from "@/frontend/components/ui";
import { getIngredientsForMatching } from "@/api/meals";
import type { IngredientRow } from "@/api/ingredients";
import { colors } from "@/frontend/constants/theme";
import { IngredientRoleTag, IngredientSearch } from "@/frontend/core/meals/components/IngredientSearch";
import {
  defaultUnit,
  ingredientChecks,
  MIN_INGREDIENTS,
  newIngredientKey,
  UNITS,
  type DraftIngredient,
  type DraftUnit,
  type RecipeDraft,
  type StepErrors,
} from "../types";
import { lineTotals, type LineTotals } from "../utils/recipeTotals";
import { resolveQuickAdds } from "../quickAdds";
import { StepHeader } from "./StepHeader";

// How long "Calculating…" shimmers after the amount or unit changes. Restarts
// on every keystroke, so typing "250" shimmers once, not per digit.
const CALCULATING_MS = 1000;

function CalculatingShimmer() {
  const pulse = useSharedValue(0.35);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 450 }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View style={style} exiting={FadeOut.duration(150)}>
      <AppText variant="caption">Calculating…</AppText>
    </Animated.View>
  );
}

// Right side of an ingredient card: blank until there's something to show,
// a short "Calculating…" shimmer after each amount/unit change, then the
// price and kcal fade in. An unconvertible unit says so right away.
function LineResult({ line, result }: { line: DraftIngredient; result: LineTotals }) {
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    if (result.status !== "ok") {
      setCalculating(false);
      return;
    }
    setCalculating(true);
    const timer = setTimeout(() => setCalculating(false), CALCULATING_MS);
    return () => clearTimeout(timer);
    // Re-run on the inputs the user changes, not on the result object
    // (recreated every render).
  }, [line.amount, line.unit, result.status]);

  if (result.status === "error") {
    return (
      <AppText variant="caption" className="text-right text-like">
        Try another unit
      </AppText>
    );
  }
  if (result.status !== "ok") return null;
  if (calculating) return <CalculatingShimmer />;

  return (
    <Animated.View key={`${line.amount}-${line.unit}`} entering={FadeIn.duration(250)} className="items-end">
      <AppText variant="caption" className="font-inter-semibold text-primary">
        ~₱{(result.totals.price ?? 0).toFixed(2)}
      </AppText>
      <AppText variant="caption">{Math.round(result.totals.calories ?? 0)} kcal</AppText>
    </Animated.View>
  );
}

// Unfocused input border (same value TextField uses), faded to red on error.
const QTY_BORDER = "rgba(43, 52, 55, 0.1)";

function IngredientLineCard({
  line,
  onChange,
  onRemove,
  qtyError,
  shakeKey,
  autoFocus,
}: {
  line: DraftIngredient;
  /** Just added: focus its quantity box. */
  autoFocus: boolean;
  onChange: (patch: Partial<DraftIngredient>) => void;
  onRemove: () => void;
  /** Quantity is required (unless "to taste"): red border + shake, the same
   *  as TextField's error behavior. */
  qtyError: boolean;
  shakeKey: number;
}) {
  const result = lineTotals(line);
  const { errorProgress, shakeStyle } = useFieldErrorAnimation(qtyError, shakeKey);
  const qtyBorderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(errorProgress.value, [0, 1], [QTY_BORDER, colors.like]),
  }));

  return (
    <Card variant="outlined" className="gap-2.5">
      <View className="flex-row items-center gap-2">
        <AppText variant="bodyBold" className="flex-shrink" numberOfLines={1}>
          {line.ingredient?.display_name ?? line.ingredient?.canonical_name ?? line.name}
        </AppText>
        <IngredientRoleTag ingredient={line.ingredient} />
        <Pressable onPress={onRemove} hitSlop={8} className="ml-auto" accessibilityLabel="Remove ingredient">
          <X color={colors.ink.subtle} size={16} />
        </Pressable>
      </View>

      <View className="flex-row items-center gap-2">
        {line.unit !== "to taste" && (
          <Animated.View style={[{ borderWidth: 1, borderRadius: 12 }, qtyBorderStyle, shakeStyle]} className="w-20">
            <TextInput
              value={line.amount}
              onChangeText={(amount) => onChange({ amount: amount.replace(/[^0-9.]/g, "") })}
              placeholder="Qty"
              placeholderTextColor={colors.ink.placeholder}
              keyboardType="decimal-pad"
              autoFocus={autoFocus}
              className="px-3 py-2 font-inter-regular text-body text-ink"
            />
          </Animated.View>
        )}
        <Dropdown
          // Left-aligned: this trigger sits on the card's left side, so the
          // default right-aligned menu would run off the left of the screen.
          align="left"
          trigger={
            <View className="flex-row items-center gap-1 rounded-xl border border-ink-emphasis/10 px-3 py-2">
              <AppText variant="body">
                {line.unit === "piece" ? (line.ingredient?.piece_label ?? "piece") : line.unit}
              </AppText>
              <ChevronDown color={colors.ink.subtle} size={14} />
            </View>
          }
          items={UNITS.map((unit) => ({
            label: unit === "piece" ? (line.ingredient?.piece_label ?? "piece") : unit,
            onPress: () => onChange({ unit: unit as DraftUnit }),
          }))}
        />
        <View className="ml-auto items-end">
          <LineResult line={line} result={result} />
        </View>
      </View>
    </Card>
  );
}

function RequirementSegment({ done }: { done: boolean }) {
  const fill = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    fill.value = withTiming(done ? 1 : 0, { duration: 280 });
  }, [done]);
  const style = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View className="h-1 flex-1 overflow-hidden rounded-full bg-ink-emphasis/10">
      <Animated.View style={[{ height: "100%", borderRadius: 999, backgroundColor: colors.primary }, style]} />
    </View>
  );
}

// The step's three rules as progress, not checkboxes: a three-part bar that
// fills as each is met, "2 of 3" beside it, and one line naming the next
// thing to do. After a failed Next that line turns amber (still to do, not
// broken). All met: a quiet "ready" line.
function IngredientRequirements({ draft, flagged }: { draft: RecipeDraft; flagged: boolean }) {
  const checks = ingredientChecks(draft);
  const met = [checks.enough, checks.main, checks.quantities].filter(Boolean).length;
  const missing = MIN_INGREDIENTS - draft.ingredients.length;
  const next = !checks.enough
    ? `Add ${missing} more ingredient${missing === 1 ? "" : "s"}${checks.main ? "" : ", including a main"}.`
    : !checks.main
      ? "Add a main ingredient: a meat, fish or vegetable."
      : !checks.quantities
        ? "Fill in a quantity for every ingredient."
        : null;

  return (
    <View className="gap-2.5 rounded-2xl bg-ink-emphasis/5 px-4 py-3" accessibilityLabel={`${met} of 3 requirements met. ${next ?? "Ready."}`}>
      <View className="flex-row items-center justify-between">
        <Text className="font-inter-semibold text-small text-ink-emphasis">Requirements</Text>
        <Text className="font-inter-semibold text-small text-ink-subtle">{met} of 3</Text>
      </View>
      <View className="flex-row gap-1.5">
        <RequirementSegment done={checks.enough} />
        <RequirementSegment done={checks.main} />
        <RequirementSegment done={checks.quantities} />
      </View>
      {next ? (
        <Text className={`font-inter-regular text-small ${flagged ? "text-notice-text" : "text-ink-subtle"}`}>{next}</Text>
      ) : (
        <View className="flex-row items-center gap-1.5">
          <Check color={colors.primary} size={14} strokeWidth={2.5} />
          <Text className="font-inter-medium text-small text-primary">Ready. Price and nutrition are counted.</Text>
        </View>
      )}
    </View>
  );
}

// One-tap adds while the search box is empty, minus what's already in.
function QuickAddChips({ added, onPick }: { added: Set<string>; onPick: (ingredient: IngredientRow) => void }) {
  const { data: all } = useQuery({
    queryKey: ["ingredients", "matching"],
    queryFn: getIngredientsForMatching,
    staleTime: 10 * 60 * 1000,
  });
  const chips = useMemo(
    () => (all ? resolveQuickAdds(all) : []).filter((q) => !added.has(q.ingredient.id)),
    [all, added],
  );
  if (chips.length === 0) return null;
  return (
    <View className="mt-3 gap-2">
      <Text className="font-inter-semibold text-small text-ink-subtle">Quick add</Text>
      <View className="flex-row flex-wrap gap-2">
        {chips.map(({ label, ingredient }) => (
          <Animated.View key={ingredient.id} exiting={FadeOut.duration(150)} layout={LinearTransition.duration(200)}>
            <Pressable
              onPress={() => onPick(ingredient)}
              accessibilityRole="button"
              accessibilityLabel={`Add ${label}`}
              className="flex-row items-center gap-1 rounded-full border border-ink-emphasis/15 bg-white px-3 py-1.5 active:bg-ink-emphasis/5"
            >
              <Plus color={colors.primary} size={13} strokeWidth={2.5} />
              <Text className="font-inter-medium text-small text-ink-emphasis">{label}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

type IngredientsStepProps = {
  draft: RecipeDraft;
  onChange: (patch: Partial<RecipeDraft>) => void;
  errors: StepErrors;
  /** Next-attempt count: empty quantity boxes shake again on each failed Next. */
  shakeKey: number;
  /** A line was just added (at the bottom): the screen scrolls to it. */
  onLineAdded?: () => void;
};

// Step 2: pick ingredients from the canonical ingredient list only, so
// price and macros always come from real ingredient data. The rules show
// up front as a checklist; a new line lands with a light tap and its
// quantity box focused (the screen scrolls it into view).
export function IngredientsStep({ draft, onChange, errors, shakeKey, onLineAdded }: IngredientsStepProps) {
  const setLines = (ingredients: DraftIngredient[]) => onChange({ ingredients });
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const addedIds = useMemo(
    () => new Set(draft.ingredients.flatMap((l) => (l.ingredient ? [l.ingredient.id] : []))),
    [draft.ingredients],
  );

  const add = (ingredient: IngredientRow) => {
    const key = newIngredientKey();
    setLines([
      ...draft.ingredients,
      {
        key,
        ingredient,
        name: ingredient.canonical_name,
        amount: "",
        unit: defaultUnit(ingredient),
      },
    ]);
    setLastAdded(key);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLineAdded?.();
  };

  return (
    <View className="gap-6">
      <StepHeader title="What goes in it" subtitle="Pick from our list, so the price and nutrition are real." />
      <IngredientSearch onPick={add} idleContent={<QuickAddChips added={addedIds} onPick={add} />} />

      <IngredientRequirements draft={draft} flagged={Object.keys(errors).length > 0} />

      {/* Lines already there when the step opens just appear; new ones
          slide in. */}
      {draft.ingredients.length > 0 && (
        <LayoutAnimationConfig skipEntering>
          <View className="gap-2">
            {draft.ingredients.map((line) => (
              <Animated.View key={line.key} entering={FadeInDown.duration(220)} layout={LinearTransition.duration(200)}>
                <IngredientLineCard
                  line={line}
                  autoFocus={line.key === lastAdded}
                  onChange={(patch) =>
                    setLines(draft.ingredients.map((l) => (l.key === line.key ? { ...l, ...patch } : l)))
                  }
                  onRemove={() => setLines(draft.ingredients.filter((l) => l.key !== line.key))}
                  // `errors` is only populated after a Next attempt.
                  qtyError={!!errors.qty && line.unit !== "to taste" && !(Number(line.amount) > 0)}
                  shakeKey={shakeKey}
                />
              </Animated.View>
            ))}
          </View>
        </LayoutAnimationConfig>
      )}
    </View>
  );
}
