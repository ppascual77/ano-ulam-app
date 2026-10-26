import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { router } from "expo-router";
import { ClipboardCheck, Link2 } from "lucide-react-native";
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
import { MealVerifyPanel } from "../components/MealVerifyPanel";
import { CopyCheckPanel } from "../components/CopyCheckPanel";
import type { PendingMealIngredient } from "../components/SeedMealIngredientsEditor";
import { AdminHeader } from "../components/AdminHeader";
import { Checklist, InlineError } from "../components/AdminUi";
import { buildMealCalculation } from "../utils/mealCalculation";
import { findCopiedRuns } from "../utils/verbatimCheck";

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
      note: "",
      section: ing.section?.trim() ?? "",
      priceQuantityAmount: "",
      priceQuantityUnit: "",
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
  // What the recipe page itself says, for the copy check. Never saved.
  const [sourceText, setSourceText] = useState<string | null>(null);

  const importMeal = useImportMealFromUrl();
  const { data: allIngredients, isLoading: ingredientsLoading, isError: ingredientsError } = useIngredientsForMatching();
  const createMeal = useCreateMeal();
  const addMealIngredient = useAddMealIngredient();
  const recomputeMealTotals = useRecomputeMealTotals();

  const handleImport = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    importMeal.mutate(trimmed, {
      onSuccess: ({ meal, source_text }) => {
        setDraft(meal);
        setForm(draftToFormState(meal));
        setSourceText(source_text ?? null);
      },
    });
  };

  const updateForm = (patch: Partial<MealFormState>) => setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  const updateIngredientItem = (key: string, patch: Partial<PendingMealIngredient>) =>
    setForm((prev) =>
      prev ? { ...prev, ingredients: prev.ingredients.map((i) => (i.key === key ? { ...i, ...patch } : i)) } : prev,
    );

  const trimmedIngredients = useMemo(
    () => (form?.ingredients ?? []).filter((i) => i.name.trim() !== ""),
    [form?.ingredients],
  );
  const allResolved = trimmedIngredients.length > 0 && trimmedIngredients.every((i) => i.ingredientId);
  // The calculation check (no AI) gates Confirm Seed: anything that would
  // silently zero out an ingredient's kcal or ₱ has to be fixed first. The
  // AI bridge check in the panel is optional.
  const calculation = useMemo(
    () => (allResolved && allIngredients ? buildMealCalculation(trimmedIngredients, allIngredients) : null),
    [allResolved, trimmedIngredients, allIngredients],
  );
  const calculationPasses = !!calculation && calculation.errorCount === 0;
  // The copy check also gates Confirm Seed: nothing taken word for word
  // from the source's description or steps (see verbatimCheck.ts).
  const copiedRuns = useMemo(
    () =>
      form && sourceText !== null
        ? findCopiedRuns(
            [
              { label: "Description", text: form.description },
              ...form.procedure.map((step, i) => ({ label: `Step ${i + 1}`, text: step })),
            ],
            sourceText,
          )
        : null,
    [form?.description, form?.procedure, sourceText],
  );
  const copyCheckPasses = copiedRuns !== null && copiedRuns.length === 0;
  const canSave =
    !!draft && !!form && form.name.trim() !== "" && allResolved && calculationPasses && copyCheckPasses && !createMeal.isPending;

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
      reference_image_url: draft.reference_image_url,
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
          note: item.note.trim() || null,
          section: item.section.trim() || null,
          price_quantity_amount: item.priceQuantityAmount.trim() === "" ? null : Number(item.priceQuantityAmount),
          price_quantity_unit: item.priceQuantityAmount.trim() === "" ? null : item.priceQuantityUnit,
          sort_order: i,
        },
      });
    }

    await recomputeMealTotals.mutateAsync(meal.id);
    router.back();
  };

  return (
    <Screen padded={false}>
      <AdminHeader title="Seed Meal" />

      {!draft || !form ? (
        <View className="px-5">
          {/* Step 1: the link. */}
          <View className="gap-4 rounded-2xl border border-ink-emphasis/10 p-5">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Link2 color={colors.primary} size={22} />
            </View>
            <View className="gap-1">
              <AppText variant="sectionSubtitle" dot>
                Import a recipe
              </AppText>
              <Text className="font-inter-regular text-body-lg text-ink">
                Paste a link to a recipe page. It will be rewritten and re-priced for the catalog —
                <Text className="font-inter-semibold"> Home-cooked (Luto) only.</Text>
              </Text>
            </View>
            <TextField
              label="Recipe URL"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            <Button
              label="Import Recipe"
              loading={importMeal.isPending}
              disabled={url.trim() === ""}
              icon={<Link2 color={colors.white} size={16} />}
              onPress={handleImport}
            />
            {importMeal.isError && (
              <InlineError>{importMeal.error instanceof Error ? importMeal.error.message : "Import failed"}</InlineError>
            )}
          </View>
        </View>
      ) : ingredientsLoading ? (
        <LoadingState />
      ) : ingredientsError || !allIngredients ? (
        <ErrorState />
      ) : (
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Step 2: review what was imported, section by section. */}
          <View className="mb-6 flex-row items-center gap-3 rounded-2xl bg-primary/5 p-4">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <ClipboardCheck color={colors.primary} size={20} />
            </View>
            <View className="flex-1">
              <Text className="font-inter-semibold text-body-lg text-ink-emphasis">Review the imported recipe</Text>
              <Text className="font-inter-regular text-body text-ink-subtle">
                Check each section, link every ingredient, verify, then save.
              </Text>
            </View>
          </View>

          <MealFormFields value={form} onChange={updateForm} allIngredients={allIngredients} />

          {calculation && (
            <MealVerifyPanel
              mealName={form.name}
              servingSize={Number(form.servingSize) || 1}
              calculation={calculation}
              onUpdateItem={updateIngredientItem}
            />
          )}

          <CopyCheckPanel runs={copiedRuns} />

          {/* Step 3: what's left before saving, then save. */}
          <View className="gap-4 rounded-2xl border border-ink-emphasis/10 p-5">
            <AppText variant="sectionSubtitle" dot>
              Ready to save
            </AppText>
            <Checklist
              items={[
                { label: "Meal has a name", done: form.name.trim() !== "" },
                {
                  label: "Every ingredient is linked",
                  done: allResolved,
                  detail: `${trimmedIngredients.filter((i) => i.ingredientId).length} of ${trimmedIngredients.length} linked to a real ingredient record`,
                },
                {
                  label: "Calculation check passes",
                  done: calculationPasses,
                  detail: calculationPasses
                    ? undefined
                    : calculation
                      ? `${calculation.errorCount} to fix in the Check above.`
                      : "Shows up once every ingredient is linked.",
                },
                {
                  label: "Description and steps are in our own words",
                  done: copyCheckPasses,
                  detail: copyCheckPasses
                    ? undefined
                    : copiedRuns === null
                      ? "Couldn't check this import. See the Copy check above."
                      : `${copiedRuns.length} copied ${copiedRuns.length === 1 ? "passage" : "passages"} to rewrite in the Copy check above.`,
                },
              ]}
            />
            <Button
              label="Confirm Seed"
              loading={createMeal.isPending || addMealIngredient.isPending || recomputeMealTotals.isPending}
              disabled={!canSave}
              onPress={handleSave}
            />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
