import { useState } from "react";
import { View, Pressable } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { router } from "expo-router";
import { ArrowLeft, Link2 } from "lucide-react-native";
import { AppText, Button, ErrorState, LoadingState, Screen, TextField } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { parseQuantityText, type ImportedMealDraft } from "@/api/meals";
import {
  useAddMealIngredient,
  useCreateMeal,
  useImportMealFromUrl,
  useIngredientsForMatching,
  useRecomputeMealTotals,
} from "../hooks/useMeals";
import { MealFormFields, type MealFormState } from "../components/MealFormFields";
import type { PendingMealIngredient } from "../components/SeedMealIngredientsEditor";

function draftIngredientsToPending(draft: ImportedMealDraft): PendingMealIngredient[] {
  return draft.ingredients.map((ing, i) => {
    // Best-effort prefill from the LLM's free-text quantity ("2 pieces",
    // "500 g") — the amount is a fact about this recipe, not something the
    // ingredients DB can supply, so this is a parse of what's already in
    // the text, not a calculation. Units this schema doesn't model fall
    // through and stay blank for the admin to set.
    const parsed = parseQuantityText(ing.quantity_text);
    return {
      key: `imported-${i}`,
      name: ing.name,
      quantityAmount: parsed?.amount ?? "",
      quantityUnit: parsed?.unit ?? "g",
      displayText: ing.quantity_text,
      ingredientId: null,
      ingredientName: null,
    };
  });
}

function draftToFormState(draft: ImportedMealDraft): MealFormState {
  return {
    name: draft.name,
    description: draft.description,
    prepTime: draft.prep_time?.toString() ?? "",
    totalTime: draft.total_time?.toString() ?? "",
    servingSize: draft.servings?.toString() ?? "1",
    difficulty: draft.difficulty ? [draft.difficulty] : [],
    proteinType: draft.protein_type ?? "",
    restaurant: "",
    source: "",
    budgetRange: "",
    dietaryTags: draft.dietary_tags,
    tags: draft.tags,
    allergens: draft.allergens,
    procedure: draft.procedure,
    ingredients: draftIngredientsToPending(draft),
  };
}

export default function SeedMealScreen() {
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState<ImportedMealDraft | null>(null);
  const [form, setForm] = useState<MealFormState | null>(null);

  const importMeal = useImportMealFromUrl();
  const { data: allIngredients, isLoading: ingredientsLoading, isError: ingredientsError } = useIngredientsForMatching();
  const createMeal = useCreateMeal();
  const addMealIngredient = useAddMealIngredient();
  const recomputeMealTotals = useRecomputeMealTotals();

  const handleImport = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    importMeal.mutate(trimmed, {
      onSuccess: ({ meal }) => {
        setDraft(meal);
        setForm(draftToFormState(meal));
      },
    });
  };

  const updateForm = (patch: Partial<MealFormState>) => setForm((prev) => (prev ? { ...prev, ...patch } : prev));

  const trimmedIngredients = (form?.ingredients ?? []).filter((i) => i.name.trim() !== "");
  const allResolved = trimmedIngredients.length > 0 && trimmedIngredients.every((i) => i.ingredientId);
  const canSave = !!draft && !!form && form.name.trim() !== "" && allResolved && !createMeal.isPending;

  const handleSave = async () => {
    if (!draft || !form) return;
    const meal = await createMeal.mutateAsync({
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: draft.category,
      difficulty: form.difficulty[0] ?? null,
      protein_type: form.proteinType.trim() || null,
      restaurant: form.restaurant.trim() || null,
      source: form.source.trim() || null,
      budget_range: form.budgetRange.trim() || null,
      prep_time: form.prepTime ? Number(form.prepTime) : null,
      total_time: form.totalTime ? Number(form.totalTime) : null,
      serving_size: Number(form.servingSize) || 1,
      procedure: form.procedure.map((s) => s.trim()).filter(Boolean),
      allergens: form.allergens,
      dietary_tags: form.dietaryTags,
      tags: form.tags,
      source_type: "ai_estimated",
    });

    for (let i = 0; i < trimmedIngredients.length; i++) {
      const item = trimmedIngredients[i];
      await addMealIngredient.mutateAsync({
        mealId: meal.id,
        input: {
          ingredient_id: item.ingredientId as string,
          quantity_amount: item.quantityAmount.trim() === "" ? null : Number(item.quantityAmount),
          quantity_unit: item.quantityAmount.trim() === "" ? null : item.quantityUnit,
          display_text: item.displayText.trim() || item.name,
          sort_order: i,
        },
      });
    }

    await recomputeMealTotals.mutateAsync(meal.id);
    router.back();
  };

  return (
    <Screen padded={false}>
      <View className="px-5 pt-2 pb-4 flex-row items-center gap-2">
        <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center">
          <ArrowLeft color={colors.ink.emphasis} size={18} />
        </Pressable>
        <View>
          <AppText variant="eyebrow">Admin</AppText>
          <AppText variant="heading">Seed Meal</AppText>
        </View>
      </View>

      {!draft || !form ? (
        <View className="px-5 gap-3">
          <AppText variant="body" className="text-ink-subtle">
            Paste a link to a recipe page. It will be rewritten and re-priced for the catalog —
            Home-cooked (Luto) only.
          </AppText>
          <TextField
            label="Recipe URL"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Button
            label={importMeal.isPending ? "Importing..." : "Import Recipe"}
            disabled={importMeal.isPending || url.trim() === ""}
            icon={<Link2 color={colors.white} size={16} />}
            onPress={handleImport}
          />
          {importMeal.isError && (
            <AppText variant="body" className="text-like">
              {importMeal.error instanceof Error ? importMeal.error.message : "Import failed"}
            </AppText>
          )}
        </View>
      ) : ingredientsLoading ? (
        <LoadingState />
      ) : ingredientsError || !allIngredients ? (
        <ErrorState />
      ) : (
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
          <MealFormFields value={form} onChange={updateForm} allIngredients={allIngredients} />

          <Button
            label={
              createMeal.isPending || addMealIngredient.isPending || recomputeMealTotals.isPending
                ? "Saving..."
                : "Confirm Seed"
            }
            disabled={!canSave}
            onPress={handleSave}
          />
          {!allResolved && trimmedIngredients.length > 0 && (
            <AppText variant="caption" className="text-like text-center mt-2">
              Every ingredient needs to be linked to a real ingredient record before saving.
            </AppText>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
