import { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { AppText, BottomSheet, SearchBar } from "@/frontend/components/ui";
import { matchIngredientCandidates } from "@/api/meals";
import type { IngredientRow } from "@/api/ingredients";
import type { DaCommodityRow } from "@/api/daPrices";

type Props = {
  commodity: DaCommodityRow | null;
  ingredients: IngredientRow[];
  // Ingredient id → the commodities already linked to it.
  linkedTo: Map<string, DaCommodityRow[]>;
  onPick: (ingredient: IngredientRow) => void;
  onClose: () => void;
  // After the close animation, when it's safe to open the next sheet.
  onClosed?: () => void;
};

const SEARCH_LIMIT = 30;

// Picks the ingredient a DA commodity prices. Starts with name-match
// suggestions (same ranking as the meal seeder); typing searches all.
export function LinkDaCommoditySheet({ commodity, ingredients, linkedTo, onPick, onClose, onClosed }: Props) {
  const [search, setSearch] = useState("");

  const results = useMemo(() => {
    if (!commodity) return [];
    const q = search.trim().toLowerCase();
    if (!q) {
      return matchIngredientCandidates(`${commodity.commodity} ${commodity.specification}`, ingredients, 8).map(
        (c) => c.ingredient,
      );
    }
    return ingredients
      .filter((i) => i.canonical_name.toLowerCase().includes(q) || i.aliases.some((a) => a.toLowerCase().includes(q)))
      .slice(0, SEARCH_LIMIT);
  }, [commodity, ingredients, search]);

  const close = () => {
    setSearch("");
    onClose();
  };

  return (
    <BottomSheet visible={!!commodity} onClose={close} onClosed={onClosed} heightPercent={0.8}>
      <View className="flex-1 px-6 pt-8">
        <AppText variant="eyebrow">Link to ingredient</AppText>
        <AppText variant="title">{commodity?.commodity}</AppText>
        {!!commodity?.specification && (
          <AppText variant="caption" className="text-ink-subtle">
            {commodity.specification}
          </AppText>
        )}

        <View className="my-4">
          <SearchBar placeholder="Search ingredients..." value={search} onChangeText={setSearch} onClear={() => setSearch("")} />
        </View>

        {!search && (
          <AppText variant="caption" className="text-ink-subtle mb-1">
            {results.length > 0 ? "Suggested" : "No name match. Search for the ingredient instead."}
          </AppText>
        )}

        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          {results.map((ingredient) => {
            const alsoLinked = (linkedTo.get(ingredient.id) ?? []).filter((c) => c.id !== commodity?.id);
            return (
              <Pressable
                key={ingredient.id}
                onPress={() => {
                  setSearch("");
                  onPick(ingredient);
                }}
                className="border-b border-ink-emphasis/10 py-3 active:bg-primary/5"
              >
                <AppText variant="bodyMedium">{ingredient.canonical_name}</AppText>
                <AppText variant="caption" className="text-ink-subtle">
                  {ingredient.estimated_price != null
                    ? `₱${ingredient.estimated_price}/${ingredient.estimated_price_unit} · ${ingredient.price_source}`
                    : "No price yet"}
                </AppText>
                {alsoLinked.length > 0 && (
                  <AppText variant="caption" className="text-primary">
                    Also priced by DA: {alsoLinked.map((c) => c.commodity).join(", ")}
                  </AppText>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}
