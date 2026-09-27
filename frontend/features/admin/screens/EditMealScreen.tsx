import { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { AppText, Button, ErrorState, LoadingState, Screen } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { MealWithIngredients, QuantityUnit } from "@/api/meals";
import {
  useIngredientsForMatching,
  useMeal,
  useRecomputeMealTotals,
  useReplaceMealIngredients,
  useUpdateMeal,
} from "../hooks/useMeals";
import { MealFormFields, type MealFormState } from "../components/MealFormFields";
import { MealImageEditor } from "../components/MealImageEditor";

const UNIT_VALUES: QuantityUnit[] = ["g", "kg", "ml", "L", "piece"];

function mealToFormState(meal: MealWithIngredients): MealFormState {
  return {
    name: meal.name,
    description: meal.description ?? "",
    prepTime: meal.prep_time?.toString() ?? "",
    totalTime: meal.total_time?.toString() ?? "",
    servingSize: meal.serving_size?.toString() ?? "1",
    difficulty: meal.difficulty ? [meal.difficulty] : [],
    proteinType: meal.protein_type ?? "",
    restaurant: meal.restaurant ?? "",
    source: meal.source ?? "",
    budgetRange: meal.budget_range ?? "",
    dietaryTags: meal.dietary_tags,
    tags: meal.tags,
    allergens: meal.allergens,
    procedure: meal.procedure,
    ingredients: meal.meal_ingredients
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((mi) => ({
        key: mi.id,
        name: mi.ingredient.canonical_name,
        quantityAmount: mi.quantity_amount != null ? mi.quantity_amount.toString() : "",
        quantityUnit: (mi.quantity_unit && UNIT_VALUES.includes(mi.quantity_unit as QuantityUnit)
          ? mi.quantity_unit
          : "g") as QuantityUnit,
        displayText: mi.display_text,
        note: mi.note ?? "",
        priceQuantityAmount: mi.price_quantity_amount != null ? mi.price_quantity_amount.toString() : "",
        priceQuantityUnit: (mi.price_quantity_unit && UNIT_VALUES.includes(mi.price_quantity_unit as QuantityUnit)
          ? mi.price_quantity_unit
          : "") as QuantityUnit | "",
        ingredientId: mi.ingredient_id,
        ingredientName: mi.ingredient.canonical_name,
      })),
  };
}

export default function EditMealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: meal, isLoading, isError } = useMeal(id ?? null);
  const { data: allIngredients, isLoading: ingredientsLoading, isError: ingredientsError } = useIngredientsForMatching();
  const updateMeal = useUpdateMeal();
  const replaceMealIngredients = useReplaceMealIngredients();
  const recomputeMealTotals = useRecomputeMealTotals();

  const [form, setForm] = useState<MealFormState | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (meal) {
      setForm(mealToFormState(meal));
      setImageUrl(meal.image_url);
    }
    // Only re-derive when a different meal loads, not on every background
    // refetch — an in-progress edit shouldn't be clobbered by a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meal?.id]);

  const updateForm = (patch: Partial<MealFormState>) => setForm((prev) => (prev ? { ...prev, ...patch } : prev));

  const trimmedIngredients = (form?.ingredients ?? []).filter((i) => i.name.trim() !== "");
  const allResolved = trimmedIngredients.length > 0 && trimmedIngredients.every((i) => i.ingredientId);
  const isSaving = updateMeal.isPending || replaceMealIngredients.isPending || recomputeMealTotals.isPending;
  const canSave = !!meal && !!form && form.name.trim() !== "" && allResolved && !isSaving;

  const handleSave = async () => {
    if (!meal || !form) return;

    await updateMeal.mutateAsync({
      id: meal.id,
      patch: {
        name: form.name.trim(),
        description: form.description.trim() || null,
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
        image_url: imageUrl,
      },
    });

    await replaceMealIngredients.mutateAsync({
      mealId: meal.id,
      inputs: trimmedIngredients.map((item, i) => ({
        ingredient_id: item.ingredientId as string,
        quantity_amount: item.quantityAmount.trim() === "" ? null : Number(item.quantityAmount),
        quantity_unit: item.quantityAmount.trim() === "" ? null : item.quantityUnit,
        display_text: item.displayText.trim() || item.name,
        note: item.note.trim() || null,
        price_quantity_amount: item.priceQuantityAmount.trim() === "" ? null : Number(item.priceQuantityAmount),
        price_quantity_unit: item.priceQuantityAmount.trim() === "" ? null : item.priceQuantityUnit,
        sort_order: i,
      })),
    });

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
          <AppText variant="heading">Edit Meal</AppText>
        </View>
      </View>

      {isLoading || ingredientsLoading ? (
        <LoadingState />
      ) : isError || !meal || !form || ingredientsError || !allIngredients ? (
        <ErrorState />
      ) : (
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
          <MealImageEditor
            imageUrl={imageUrl}
            mealId={meal.id}
            mealName={form.name}
            mealDescription={form.description || null}
            referenceImageUrl={meal.reference_image_url}
            onImageChange={setImageUrl}
          />

          <MealFormFields value={form} onChange={updateForm} allIngredients={allIngredients} />

          <Button label={isSaving ? "Saving..." : "Save Changes"} disabled={!canSave} onPress={handleSave} />
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
