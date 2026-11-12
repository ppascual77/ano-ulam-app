import { Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { RollingText } from "@/frontend/components/ui";
import { servingsCount, type RecipeDraft } from "../types";
import { recipeTotals } from "../utils/recipeTotals";

// Tabular figures, so a rolling number never shifts the column it sits in.
const TABULAR = { fontVariant: ["tabular-nums" as const] };

function Stat({ label, value, rank, first, accent }: { label: string; value: string; rank: number; first?: boolean; accent?: boolean }) {
  return (
    <View className={`flex-1 gap-0.5 ${first ? "" : "border-l border-ink-emphasis/10 pl-4"}`}>
      <Text className="font-inter-medium text-small text-ink-subtle" numberOfLines={1}>
        {label}
      </Text>
      <RollingText
        value={value}
        rank={rank}
        style={TABULAR}
        className={`font-inter-extrabold text-subheading ${accent ? "text-primary" : "text-ink-emphasis"}`}
      />
    </View>
  );
}

// Pinned above the Ingredients step's footer (and so above the keyboard):
// the whole recipe's cost, one serving's, and the calories, in three equal
// columns, each number rolling as lines change. Same math as the Review
// card (recipeTotals over every countable line); a line without a quantity
// yet (or "to taste") counts as 0 until filled in.
export function RecipeCostSummary({ draft }: { draft: RecipeDraft }) {
  if (draft.ingredients.length === 0) return null;
  const totals = recipeTotals(draft.ingredients);
  const servings = servingsCount(draft);
  const total = Math.round(totals.price);
  const perServing = Math.round(totals.price / servings);
  const kcal = Math.round(totals.calories);

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(150)}
      className="flex-row border-t border-ink-emphasis/10 bg-white px-5 pb-1 pt-3"
      accessibilityLabel={`About ${total} pesos in total, ${perServing} pesos per serving, ${kcal} calories`}
    >
      <Stat first accent label="Total cost" value={`₱${total}`} rank={total} />
      <Stat label={`Per serving (${servings})`} value={`₱${perServing}`} rank={perServing} />
      <Stat label="Calories" value={`${kcal} kcal`} rank={kcal} />
    </Animated.View>
  );
}
