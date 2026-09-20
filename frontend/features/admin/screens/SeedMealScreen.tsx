import { useState } from "react";
import { View, Pressable } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { router } from "expo-router";
import { ArrowLeft, Trash2 } from "lucide-react-native";
import { AppText, Button, ChipSelect, ErrorState, LoadingState, Screen, TextField } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import {
  useAddMealIngredient,
  useCreateMeal,
  useIngredientsForMatching,
  useRecomputeMealTotals,
} from "../hooks/useMeals";
import {
  SeedMealIngredientsEditor,
  newPendingIngredient,
  resolvePendingIngredient,
  type PendingMealIngredient,
} from "../components/SeedMealIngredientsEditor";
import { SyncIngredientsPanel } from "../components/SyncIngredientsPanel";

const CATEGORY_OPTIONS = [
  { id: "luto", label: "Home-cooked (Luto)" },
  { id: "fast_food", label: "Fast Food" },
];
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

export default function SeedMealScreen() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string[]>(["luto"]);
  const [difficulty, setDifficulty] = useState<string[]>([]);
  const [prepTime, setPrepTime] = useState("");
  const [totalTime, setTotalTime] = useState("");
  const [servingSize, setServingSize] = useState("1");
  const [procedure, setProcedure] = useState<string[]>([""]);
  const [ingredients, setIngredients] = useState<PendingMealIngredient[]>([newPendingIngredient()]);

  const { data: allIngredients, isLoading, isError } = useIngredientsForMatching();
  const createMeal = useCreateMeal();
  const addMealIngredient = useAddMealIngredient();
  const recomputeMealTotals = useRecomputeMealTotals();

  const trimmedIngredients = ingredients.filter((i) => i.name.trim() !== "");
  const allResolved = trimmedIngredients.length > 0 && trimmedIngredients.every((i) => i.ingredientId);
  const canSave = name.trim() !== "" && allResolved && !createMeal.isPending;

  const handleProcedureChange = (index: number, text: string) => {
    setProcedure((prev) => prev.map((step, i) => (i === index ? text : step)));
  };
  const removeProcedureStep = (index: number) => {
    setProcedure((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const meal = await createMeal.mutateAsync({
      name: name.trim(),
      description: description.trim() || null,
      category: category[0] ?? null,
      difficulty: difficulty[0] ?? null,
      prep_time: prepTime ? Number(prepTime) : null,
      total_time: totalTime ? Number(totalTime) : null,
      serving_size: Number(servingSize) || 1,
      procedure: procedure.map((s) => s.trim()).filter(Boolean),
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

  if (isLoading) return <LoadingState />;
  if (isError || !allIngredients) return <ErrorState />;

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

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
        <Section title="Basic Info">
          <TextField label="Meal name" value={name} onChangeText={setName} />
          <TextField label="Description" value={description} onChangeText={setDescription} multiline />
          <AppText variant="caption">Category</AppText>
          <ChipSelect mode="single" options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
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
          <SeedMealIngredientsEditor items={ingredients} onChange={setIngredients} />
        </Section>

        {trimmedIngredients.length > 0 && (
          <Section title="">
            <SyncIngredientsPanel
              items={trimmedIngredients}
              allIngredients={allIngredients}
              onResolve={(key, ingredient) => setIngredients((prev) => resolvePendingIngredient(prev, key, ingredient))}
            />
          </Section>
        )}

        <Button
          label={createMeal.isPending || addMealIngredient.isPending || recomputeMealTotals.isPending ? "Saving..." : "Confirm Seed"}
          disabled={!canSave}
          onPress={handleSave}
        />
        {!allResolved && trimmedIngredients.length > 0 && (
          <AppText variant="caption" className="text-like text-center mt-2">
            Every ingredient needs to be linked to a real ingredient record before saving.
          </AppText>
        )}
      </ScrollView>
    </Screen>
  );
}
