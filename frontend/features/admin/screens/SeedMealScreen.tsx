import { useState } from "react";
import { View, Pressable } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { router } from "expo-router";
import { ArrowLeft, Link2, Trash2 } from "lucide-react-native";
import { AppText, Button, ChipSelect, ErrorState, LoadingState, Screen, TextField } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { ImportedMealDraft } from "@/api/meals";
import {
  useAddMealIngredient,
  useCreateMeal,
  useImportMealFromUrl,
  useIngredientsForMatching,
  useRecomputeMealTotals,
} from "../hooks/useMeals";
import {
  SeedMealIngredientsEditor,
  type PendingMealIngredient,
} from "../components/SeedMealIngredientsEditor";

const DIFFICULTY_OPTIONS = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3 mb-6">
      <AppText variant="bodyBold">{title}</AppText>
      {children}
    </View>
  );
}

function draftIngredientsToPending(draft: ImportedMealDraft): PendingMealIngredient[] {
  return draft.ingredients.map((ing, i) => ({
    key: `imported-${i}`,
    name: ing.name,
    // The LLM returns a human quantity string ("1/4 cup", "3 cloves") this
    // schema can't parse directly (no cup/tbsp units) — kept as the
    // display text so nothing is lost, while amount/unit start blank for
    // the admin to set the real numeric value while binding each
    // ingredient's database match inline below.
    quantityAmount: "",
    quantityUnit: "g",
    displayText: ing.quantity_text,
    ingredientId: null,
    ingredientName: null,
  }));
}

export default function SeedMealScreen() {
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState<ImportedMealDraft | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<string[]>([]);
  const [prepTime, setPrepTime] = useState("");
  const [totalTime, setTotalTime] = useState("");
  const [servingSize, setServingSize] = useState("1");
  const [procedure, setProcedure] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<PendingMealIngredient[]>([]);

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
        setName(meal.name);
        setDescription(meal.description);
        setDifficulty(meal.difficulty ? [meal.difficulty] : []);
        setPrepTime(meal.prep_time?.toString() ?? "");
        setTotalTime(meal.total_time?.toString() ?? "");
        setServingSize(meal.servings?.toString() ?? "1");
        setProcedure(meal.procedure);
        setIngredients(draftIngredientsToPending(meal));
      },
    });
  };

  const handleProcedureChange = (index: number, text: string) => {
    setProcedure((prev) => prev.map((step, i) => (i === index ? text : step)));
  };
  const removeProcedureStep = (index: number) => {
    setProcedure((prev) => prev.filter((_, i) => i !== index));
  };

  const trimmedIngredients = ingredients.filter((i) => i.name.trim() !== "");
  const allResolved = trimmedIngredients.length > 0 && trimmedIngredients.every((i) => i.ingredientId);
  const canSave = !!draft && name.trim() !== "" && allResolved && !createMeal.isPending;

  const handleSave = async () => {
    if (!draft) return;
    const meal = await createMeal.mutateAsync({
      name: name.trim(),
      description: description.trim() || null,
      category: draft.category,
      difficulty: difficulty[0] ?? null,
      protein_type: draft.protein_type,
      prep_time: prepTime ? Number(prepTime) : null,
      total_time: totalTime ? Number(totalTime) : null,
      serving_size: Number(servingSize) || 1,
      procedure: procedure.map((s) => s.trim()).filter(Boolean),
      allergens: draft.allergens,
      dietary_tags: draft.dietary_tags,
      tags: draft.tags,
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

      {!draft ? (
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
          <Section title="Basic Info">
            <TextField label="Meal name" value={name} onChangeText={setName} />
            <TextField label="Description" value={description} onChangeText={setDescription} multiline />
          </Section>

          <Section title="Timing & Details">
            <TextField label="Prep time (min)" value={prepTime} onChangeText={setPrepTime} keyboardType="numeric" />
            <TextField label="Total time (min)" value={totalTime} onChangeText={setTotalTime} keyboardType="numeric" />
            <TextField label="Serving size" value={servingSize} onChangeText={setServingSize} keyboardType="numeric" />
            <AppText variant="caption">Difficulty</AppText>
            <ChipSelect mode="single" options={DIFFICULTY_OPTIONS} value={difficulty} onChange={setDifficulty} />
          </Section>

          <Section title="Procedure">
            {procedure.map((step, index) => (
              <View key={index} className="flex-row items-center gap-2">
                <View className="flex-1">
                  <TextField
                    label={`Step ${index + 1}`}
                    value={step}
                    onChangeText={(v) => handleProcedureChange(index, v)}
                    multiline
                  />
                </View>
                <Pressable onPress={() => removeProcedureStep(index)} className="h-9 w-9 items-center justify-center">
                  <Trash2 color={colors.like} size={18} />
                </Pressable>
              </View>
            ))}
            <Button label="+ Add step" variant="outline" onPress={() => setProcedure((prev) => [...prev, ""])} />
          </Section>

          <Section title="Ingredients">
            <SeedMealIngredientsEditor items={ingredients} allIngredients={allIngredients} onChange={setIngredients} />
          </Section>

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
