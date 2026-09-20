import { useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Trash2, Check, ChevronDown } from "lucide-react-native";
import { AppText, Button, Dropdown, TextField } from "@/frontend/components/ui";
import type { DropdownItem } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import {
  applyUsdaMatch,
  createIngredient,
  groundIngredientsUsda,
  type IngredientRow,
  type UsdaGroundingMatch,
} from "@/api/ingredients";
import { matchIngredientCandidates, type QuantityUnit } from "@/api/meals";

export type { QuantityUnit };

export type PendingMealIngredient = {
  key: string;
  name: string;
  quantityAmount: string;
  quantityUnit: QuantityUnit;
  displayText: string;
  ingredientId: string | null;
  ingredientName: string | null; // for display once resolved, without refetching
};

const UNIT_OPTIONS: { id: QuantityUnit; label: string }[] = [
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

// Mirrors TextField's floating-label layout (small label above the value,
// both inside the same bordered box) so a select reads as the same kind of
// field, not a different control — just statically in the "filled" state
// since a select always has a current value, no empty/focus transition to
// animate between.
function SelectField({ label, valueLabel }: { label: string; valueLabel: string }) {
  return (
    <View
      className="flex-row items-center justify-between px-4"
      style={{ borderRadius: 16, borderWidth: 1, height: 55, borderColor: "rgba(43, 52, 55, 0.1)" }}
    >
      <View className="flex-1 justify-center" style={{ height: 44 }}>
        <Text className="font-inter-medium text-caption text-ink-subtle">{label}</Text>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          className="font-inter-semibold text-subheading text-ink-emphasis"
        >
          {valueLabel}
        </Text>
      </View>
      <ChevronDown color={colors.ink.subtle} size={16} />
    </View>
  );
}

type UsdaSearchState = { loading: boolean; candidates: UsdaGroundingMatch[] | null; error: string | null };

function IngredientRowCard({
  item,
  allIngredients,
  onChange,
  onRemove,
  onResolve,
}: {
  item: PendingMealIngredient;
  allIngredients: IngredientRow[];
  onChange: (patch: Partial<PendingMealIngredient>) => void;
  onRemove: () => void;
  onResolve: (ingredient: IngredientRow) => void;
}) {
  const [usdaSearch, setUsdaSearch] = useState<UsdaSearchState | null>(null);
  const [creating, setCreating] = useState(false);

  const candidates = useMemo(
    () => (item.name.trim() ? matchIngredientCandidates(item.name, allIngredients) : []),
    [item.name, allIngredients],
  );

  const unitItems: DropdownItem[] = UNIT_OPTIONS.map((opt) => ({
    label: opt.label,
    onPress: () => onChange({ quantityUnit: opt.id }),
  }));

  // Per-100g macros of the candidate itself (not scaled to this meal's
  // quantity) — what actually lets an admin sanity-check "is this really
  // the same food", since scaled totals depend on a quantity that might
  // not even be filled in yet.
  const macroPreview = (calories: number | null, protein: number | null, carbohydrates: number | null, fat: number | null) => {
    const parts: string[] = [];
    if (calories != null) parts.push(`${calories.toFixed(0)} cal`);
    if (protein != null) parts.push(`${protein.toFixed(1)}g P`);
    if (carbohydrates != null) parts.push(`${carbohydrates.toFixed(1)}g C`);
    if (fat != null) parts.push(`${fat.toFixed(1)}g F`);
    return parts.length > 0 ? `${parts.join(" · ")} per 100g` : "no macro data";
  };

  const candidateItems: DropdownItem[] = candidates.map(({ ingredient, score }) => ({
    label: `${ingredient.canonical_name} — score ${score}\n${macroPreview(ingredient.calories, ingredient.protein, ingredient.carbohydrates, ingredient.fat)}`,
    onPress: () => onResolve(ingredient),
  }));

  const handleSearchUsda = async () => {
    setUsdaSearch({ loading: true, candidates: null, error: null });
    try {
      const [result] = await groundIngredientsUsda([{ id: item.key, canonicalName: item.name }]);
      if (!result || result.confidence === "NONE") {
        setUsdaSearch({ loading: false, candidates: [], error: null });
      } else if (result.confidence === "ERROR") {
        setUsdaSearch({ loading: false, candidates: null, error: result.error });
      } else {
        setUsdaSearch({ loading: false, candidates: result.candidates, error: null });
      }
    } catch (err) {
      setUsdaSearch({ loading: false, candidates: null, error: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleAddAndUse = async (candidate: UsdaGroundingMatch) => {
    setCreating(true);
    try {
      const patch = applyUsdaMatch(candidate, "HIGH");
      const created = await createIngredient({
        canonical_name: item.name,
        role: "main",
        state: null,
        basis_amount: 100,
        basis_unit: "g",
        price_source: "manual",
        ...patch,
      });
      onResolve(created);
      setUsdaSearch(null);
    } finally {
      setCreating(false);
    }
  };

  return (
    <View className="gap-2 rounded-2xl border border-ink-emphasis/10 p-3">
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <TextField label="Ingredient name" value={item.name} onChangeText={(v) => onChange({ name: v })} />
        </View>
        <Pressable onPress={onRemove} className="h-9 w-9 items-center justify-center">
          <Trash2 color={colors.like} size={18} />
        </Pressable>
      </View>

      <View className="flex-row gap-2">
        <View className="flex-1">
          <TextField
            label="Qty amount"
            value={item.quantityAmount}
            onChangeText={(v) => onChange({ quantityAmount: v })}
            keyboardType="numeric"
          />
        </View>
        <View className="flex-1">
          <Dropdown
            trigger={<SelectField label="Unit" valueLabel={item.quantityUnit} />}
            items={unitItems}
          />
        </View>
      </View>

      <TextField
        label={'Display text (e.g. "3 cloves", "to taste")'}
        value={item.displayText}
        onChangeText={(v) => onChange({ displayText: v })}
      />

      <Dropdown
        trigger={
          <SelectField
            label="Ingredient database match"
            valueLabel={item.ingredientName ?? (candidates.length > 0 ? `${candidates.length} match(es) found` : "No match — try Search USDA below")}
          />
        }
        items={candidateItems.length > 0 ? candidateItems : [{ label: "No matches yet", onPress: () => {} }]}
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

      {usdaSearch?.candidates && usdaSearch.candidates.length > 0 ? (
        <Dropdown
          trigger={
            <SelectField
              label="USDA match"
              valueLabel={creating ? "Adding..." : `${usdaSearch.candidates.length} result(s) — tap to add + use`}
            />
          }
          items={usdaSearch.candidates.map((c) => ({
            label: `${c.description} — score ${c.score}\n${macroPreview(c.calories, c.protein, c.carbohydrates, c.fat)}`,
            onPress: () => handleAddAndUse(c),
          }))}
        />
      ) : (
        <Pressable onPress={handleSearchUsda} disabled={usdaSearch?.loading}>
          <AppText variant="caption" className="text-primary">
            {usdaSearch?.loading ? "Searching USDA..." : "Search USDA"}
          </AppText>
        </Pressable>
      )}

      {usdaSearch?.error && (
        <AppText variant="caption" className="text-like">
          {usdaSearch.error}
        </AppText>
      )}
      {usdaSearch?.candidates?.length === 0 && (
        <AppText variant="caption" className="text-ink-subtle">
          No USDA match either — try adjusting the name.
        </AppText>
      )}
    </View>
  );
}

type Props = {
  items: PendingMealIngredient[];
  allIngredients: IngredientRow[];
  onChange: (items: PendingMealIngredient[]) => void;
};

export function SeedMealIngredientsEditor({ items, allIngredients, onChange }: Props) {
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

  const resolve = (key: string, ingredient: IngredientRow) => {
    onChange(resolvePendingIngredient(items, key, ingredient));
  };

  const remove = (key: string) => onChange(items.filter((item) => item.key !== key));

  return (
    <View className="gap-4">
      {items.map((item) => (
        <IngredientRowCard
          key={item.key}
          item={item}
          allIngredients={allIngredients}
          onChange={(patch) => update(item.key, patch)}
          onRemove={() => remove(item.key)}
          onResolve={(ingredient) => resolve(item.key, ingredient)}
        />
      ))}

      <Button label="+ Add ingredient" variant="outline" onPress={() => onChange([...items, newPendingIngredient()])} />
    </View>
  );
}
