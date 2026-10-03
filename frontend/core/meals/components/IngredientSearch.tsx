import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Flag, Plus, Search } from "lucide-react-native";
import { AppText } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { getIngredientsForMatching } from "@/api/meals";
import type { IngredientRow } from "@/api/ingredients";

const RESULT_LIMIT = 6;

// As-you-type matching over an ingredient's canonical name, display name
// and aliases (e.g. "bawang" for garlic), so "chi" already finds chicken.
// Ranked: a name starting with the query, then a word in a name starting
// with it, then the query anywhere in a name. Within each tier a match on
// the ingredient's own name beats an alias match (so "chi" lists chicken
// before pechay, whose alias "chinese cabbage" also starts with "chi"),
// then shorter names first. Deliberately separate from matchIngredientCandidates (Seed Meal's
// whole-word matcher for pasted recipe lines), which needs full words.
function searchIngredients(query: string, ingredients: IngredientRow[], limit: number): IngredientRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const ranked: { ingredient: IngredientRow; rank: number }[] = [];
  for (const ingredient of ingredients) {
    const names = [
      ...[ingredient.canonical_name, ingredient.display_name ?? ""].map((name) => ({ name, alias: false })),
      ...ingredient.aliases.map((name) => ({ name, alias: true })),
    ].filter((n) => n.name);
    let rank = Infinity;
    for (const { name: raw, alias } of names) {
      const name = raw.toLowerCase();
      const penalty = alias ? 0.5 : 0;
      if (name.startsWith(q)) rank = Math.min(rank, 0 + penalty);
      else if (name.split(/[^a-z0-9]+/).some((word) => word.startsWith(q))) rank = Math.min(rank, 1 + penalty);
      else if (name.includes(q)) rank = Math.min(rank, 2 + penalty);
    }
    if (rank !== Infinity) ranked.push({ ingredient, rank });
  }
  return ranked
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.ingredient.canonical_name.length - b.ingredient.canonical_name.length ||
        a.ingredient.canonical_name.localeCompare(b.ingredient.canonical_name),
    )
    .slice(0, limit)
    .map((r) => r.ingredient);
}

// Main / Pantry / Needs review pill for an ingredient line. `null` = a
// free-text line not yet linked to a canonical ingredient.
export function IngredientRoleTag({ ingredient }: { ingredient: IngredientRow | null }) {
  const { label, bg, text } = !ingredient
    ? { label: "Needs review", bg: "bg-notice-bg", text: "text-notice-text" }
    : ingredient.role === "main"
      ? { label: "Main", bg: "bg-primary/10", text: "text-primary" }
      : { label: "Pantry", bg: "bg-ink-emphasis/5", text: "text-ink-subtle" };
  return (
    <View className={`rounded-full px-2 py-1 ${bg}`}>
      <Text className={`font-inter-semibold text-sub ${text}`}>{label}</Text>
    </View>
  );
}

type IngredientSearchProps = {
  onPick: (ingredient: IngredientRow) => void;
  /** When set, a last row offers adding the typed text as an unmatched,
   *  flagged ingredient (user recipe submissions). */
  onAddFreeText?: (name: string) => void;
  placeholder?: string;
  initialQuery?: string;
  /** Ingredients already picked (e.g. in the pantry): listed but not
   *  pickable, tagged "Added". */
  disabledIds?: Set<string>;
};

// Search box over the canonical ingredients table, matching as you type
// (see searchIngredients). Used by Add a Recipe's ingredient step and by
// Review Recipes when linking a flagged ingredient, and by the PantrySheet.
export function IngredientSearch({
  onPick,
  onAddFreeText,
  placeholder = "Search ingredients (e.g. chicken, garlic)",
  initialQuery = "",
  disabledIds,
}: IngredientSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const { data: allIngredients, isLoading } = useQuery({
    queryKey: ["ingredients", "matching"],
    queryFn: getIngredientsForMatching,
    staleTime: 10 * 60 * 1000,
  });

  const results = useMemo(
    () => (allIngredients ? searchIngredients(query, allIngredients, RESULT_LIMIT) : []),
    [query, allIngredients],
  );

  const pick = (ingredient: IngredientRow) => {
    onPick(ingredient);
    setQuery("");
  };

  return (
    <View>
      <View className="flex-row items-center gap-2 rounded-xl border border-ink-emphasis/10 px-3 py-2.5">
        <Search color={colors.ink.subtle} size={16} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={colors.ink.placeholder}
          autoCorrect={false}
          className="flex-1 font-inter-regular text-body text-ink"
        />
        {isLoading && <ActivityIndicator size="small" color={colors.ink.subtle} />}
      </View>

      {query.trim().length > 0 && (
        <View className="mt-2 overflow-hidden rounded-xl border border-ink-emphasis/10">
          {results.map((ingredient) => {
            const added = disabledIds?.has(ingredient.id) ?? false;
            return (
              <Pressable
                key={ingredient.id}
                onPress={() => pick(ingredient)}
                disabled={added}
                className={`flex-row items-center gap-2 border-b border-ink-emphasis/5 px-3 py-3 active:bg-ink-emphasis/5 ${added ? "opacity-40" : ""}`}
              >
                <Plus color={colors.primary} size={14} />
                <AppText variant="body" className="flex-1" numberOfLines={1}>
                  {ingredient.canonical_name}
                </AppText>
                {added ? (
                  <AppText variant="caption">Added</AppText>
                ) : (
                  <IngredientRoleTag ingredient={ingredient} />
                )}
              </Pressable>
            );
          })}
          {results.length === 0 && !onAddFreeText && (
            <AppText variant="caption" className="px-3 py-3">
              No matches.
            </AppText>
          )}
          {onAddFreeText && (
            <Pressable
              onPress={() => {
                onAddFreeText(query.trim());
                setQuery("");
              }}
              className="flex-row items-center gap-2 px-3 py-3 active:bg-ink-emphasis/5"
            >
              <Flag color={colors.notice.icon} size={14} />
              <AppText variant="body" className="flex-1">
                Add "{query.trim()}" as a new ingredient
              </AppText>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
