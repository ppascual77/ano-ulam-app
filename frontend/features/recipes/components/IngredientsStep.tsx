import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { ChevronDown, Info, X } from "lucide-react-native";
import { AppText, Card, Dropdown, NoticeBanner, useFieldErrorAnimation } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { IngredientRoleTag, IngredientSearch } from "@/frontend/core/meals/components/IngredientSearch";
import {
  defaultUnit,
  MIN_INGREDIENTS,
  UNITS,
  type DraftIngredient,
  type DraftUnit,
  type RecipeDraft,
  type StepErrors,
} from "../types";
import { lineTotals, type LineTotals } from "../utils/recipeTotals";

let nextKey = 1;
const newKey = () => `ing-${nextKey++}`;

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
}: {
  line: DraftIngredient;
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
              <AppText variant="body">{line.unit === "piece" ? line.ingredient?.piece_label ?? "piece" : line.unit}</AppText>
              <ChevronDown color={colors.ink.subtle} size={14} />
            </View>
          }
          items={UNITS.map((unit) => ({
            label: unit === "piece" ? line.ingredient?.piece_label ?? "piece" : unit,
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

// One friendly "what's left" sentence for the amber banner, built from
// whichever ingredient checks are still unmet (see validateIngredients).
function almostThereMessage(draft: RecipeDraft, errors: StepErrors): string | null {
  const todo: string[] = [];
  if (errors.ingredients) {
    const missing = MIN_INGREDIENTS - draft.ingredients.length;
    todo.push(`add ${missing} more ingredient${missing === 1 ? "" : "s"}`);
  }
  if (errors.main || (errors.ingredients && !draft.ingredients.some((i) => i.ingredient?.role === "main"))) {
    todo.push("include at least one main (like chicken, pork, fish, or vegetables)");
  }
  // Missing quantities aren't listed here: those boxes turn red and shake.
  if (todo.length === 0) return null;
  const sentence = todo.length === 1 ? todo[0] : `${todo.slice(0, -1).join(", ")} and ${todo[todo.length - 1]}`;
  return `Almost there! Just ${sentence}.`;
}

type IngredientsStepProps = {
  draft: RecipeDraft;
  onChange: (patch: Partial<RecipeDraft>) => void;
  errors: StepErrors;
  /** Next-attempt count: empty quantity boxes shake again on each failed Next. */
  shakeKey: number;
};

// Step 2: pick ingredients from the canonical ingredient list only, so
// price and macros always come from real ingredient data.
export function IngredientsStep({ draft, onChange, errors, shakeKey }: IngredientsStepProps) {
  const setLines = (ingredients: DraftIngredient[]) => onChange({ ingredients });

  return (
    <View className="gap-4">
      <IngredientSearch
        onPick={(ingredient) =>
          setLines([
            ...draft.ingredients,
            { key: newKey(), ingredient, name: ingredient.canonical_name, amount: "", unit: defaultUnit(ingredient) },
          ])
        }
      />

      {draft.ingredients.length === 0 ? (
        <AppText variant="caption" className="text-center">
          Add at least 3 ingredients, including one main ingredient.
        </AppText>
      ) : (
        <View className="gap-2">
          {draft.ingredients.map((line) => (
            <IngredientLineCard
              key={line.key}
              line={line}
              onChange={(patch) =>
                setLines(draft.ingredients.map((l) => (l.key === line.key ? { ...l, ...patch } : l)))
              }
              onRemove={() => setLines(draft.ingredients.filter((l) => l.key !== line.key))}
              // `errors` is only populated after a Next attempt.
              qtyError={!!errors.qty && line.unit !== "to taste" && !(Number(line.amount) > 0)}
              shakeKey={shakeKey}
            />
          ))}
        </View>
      )}

      {/* Amber, not red: these are steps still to do, not something broken. */}
      {almostThereMessage(draft, errors) && (
        <NoticeBanner icon={<Info color={colors.notice.icon} size={15} />}>
          <AppText variant="caption" className="text-notice-text">
            {almostThereMessage(draft, errors)}
          </AppText>
        </NoticeBanner>
      )}
    </View>
  );
}
