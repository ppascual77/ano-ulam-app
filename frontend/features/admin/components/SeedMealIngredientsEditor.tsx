import { View, Pressable } from "react-native";
import { Trash2, Check } from "lucide-react-native";
import { AppText, Button, ChipSelect, TextField } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { IngredientRow } from "@/api/ingredients";

export type QuantityUnit = "g" | "kg" | "ml" | "L" | "piece";

export type PendingMealIngredient = {
  key: string;
  name: string;
  quantityAmount: string;
  quantityUnit: QuantityUnit;
  displayText: string;
  ingredientId: string | null;
  ingredientName: string | null; // for display once resolved, without refetching
};

const UNIT_OPTIONS = [
  { id: "g", label: "g" },
  { id: "kg", label: "kg" },
  { id: "ml", label: "ml" },
  { id: "L", label: "L" },
  { id: "piece", label: "piece" },
];

let counter = 0;
export function newPendingIngredient(): PendingMealIngredient {
  counter += 1;
  return {
    key: `pending-${Date.now()}-${counter}`,
    name: "",
    quantityAmount: "",
    quantityUnit: "g",
    displayText: "",
    ingredientId: null,
    ingredientName: null,
  };
}

type Props = {
  items: PendingMealIngredient[];
  onChange: (items: PendingMealIngredient[]) => void;
};

export function SeedMealIngredientsEditor({ items, onChange }: Props) {
  const update = (key: string, patch: Partial<PendingMealIngredient>) => {
    onChange(
      items.map((item) =>
        item.key === key
          ? {
              ...item,
              ...patch,
              // Editing the name/qty after a bind invalidates that bind —
              // the resolved ingredient may no longer be the right match.
              ...(patch.name !== undefined || patch.quantityAmount !== undefined || patch.quantityUnit !== undefined
                ? { ingredientId: null, ingredientName: null }
                : {}),
            }
          : item,
      ),
    );
  };

  const remove = (key: string) => onChange(items.filter((item) => item.key !== key));

  return (
    <View className="gap-4">
      {items.map((item) => (
        <View key={item.key} className="gap-2 rounded-2xl border border-ink-emphasis/10 p-3">
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <TextField
                label="Ingredient name"
                value={item.name}
                onChangeText={(v) => update(item.key, { name: v })}
              />
            </View>
            <Pressable onPress={() => remove(item.key)} className="h-9 w-9 items-center justify-center">
              <Trash2 color={colors.like} size={18} />
            </Pressable>
          </View>

          <View className="flex-row gap-2">
            <View className="flex-1">
              <TextField
                label="Qty amount"
                value={item.quantityAmount}
                onChangeText={(v) => update(item.key, { quantityAmount: v })}
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1 gap-1">
              <AppText variant="caption">Unit</AppText>
              <ChipSelect
                mode="single"
                options={UNIT_OPTIONS}
                value={[item.quantityUnit]}
                onChange={(v) => update(item.key, { quantityUnit: (v[0] as QuantityUnit) ?? "g" })}
              />
            </View>
          </View>

          <TextField
            label={'Display text (e.g. "3 cloves", "to taste")'}
            value={item.displayText}
            onChangeText={(v) => update(item.key, { displayText: v })}
          />

          {item.ingredientId ? (
            <View className="flex-row items-center gap-2">
              <Check color={colors.primary} size={14} />
              <AppText variant="caption" className="text-primary">
                Linked to {item.ingredientName}
              </AppText>
            </View>
          ) : (
            <AppText variant="caption" className="text-like">
              Not yet linked to a real ingredient
            </AppText>
          )}
        </View>
      ))}

      <Button label="+ Add ingredient" variant="outline" onPress={() => onChange([...items, newPendingIngredient()])} />
    </View>
  );
}

export function resolvePendingIngredient(
  items: PendingMealIngredient[],
  key: string,
  ingredient: IngredientRow,
): PendingMealIngredient[] {
  return items.map((item) =>
    item.key === key
      ? {
          ...item,
          ingredientId: ingredient.id,
          ingredientName: ingredient.canonical_name,
          displayText: item.displayText.trim() || `${item.quantityAmount} ${item.quantityUnit}`,
        }
      : item,
  );
}
