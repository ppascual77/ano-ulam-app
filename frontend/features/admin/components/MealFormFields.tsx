import { View, Pressable } from "react-native";
import { Trash2 } from "lucide-react-native";
import { AppText, Button, ChipSelect, TextField } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { IngredientRow } from "@/api/ingredients";
import { PILL_TAG_IDS, PILL_TAG_OPTIONS } from "../utils/pillTags";
import { SeedMealIngredientsEditor, type PendingMealIngredient } from "./SeedMealIngredientsEditor";

// Shared by SeedMealScreen's post-import review and EditMealScreen — both
// edit the same underlying meal shape, so the field set lives in one place
// rather than two copies drifting apart.
export type MealFormState = {
  name: string;
  description: string;
  prepTime: string;
  totalTime: string;
  servingSize: string;
  difficulty: string[];
  proteinType: string;
  restaurant: string;
  source: string;
  budgetRange: string;
  dietaryTags: string[];
  tags: string[];
  allergens: string[];
  procedure: string[];
  ingredients: PendingMealIngredient[];
};

const DIFFICULTY_OPTIONS = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
];

const DIETARY_TAG_OPTIONS = [
  { id: "vegetarian", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "pescatarian", label: "Pescatarian" },
  { id: "keto", label: "Keto" },
  { id: "paleo", label: "Paleo" },
  { id: "gluten_free", label: "Gluten-free" },
  { id: "dairy_free", label: "Dairy-free" },
  { id: "halal", label: "Halal" },
];

// Way of cooking — filter-only (see QuickFilters), no pill badge like the
// nutrition/style tags get, so these live here rather than in
// core/meals/utils/constants.ts's pill config.
const COOKING_METHOD_OPTIONS = [
  { id: "soupy", label: "Soupy" },
  { id: "grilled", label: "Grilled" },
  { id: "fried", label: "Fried" },
];
const COOKING_METHOD_IDS = new Set(COOKING_METHOD_OPTIONS.map((o) => o.id));

const ALLERGEN_OPTIONS = [
  { id: "nuts", label: "Nuts" },
  { id: "gluten", label: "Gluten" },
  { id: "dairy", label: "Dairy" },
  { id: "egg", label: "Egg" },
  { id: "shellfish", label: "Shellfish" },
  { id: "fish", label: "Fish" },
  { id: "soy", label: "Soy" },
  { id: "coconut", label: "Coconut" },
  { id: "sesame", label: "Sesame" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3 mb-6">
      <AppText variant="bodyBold">{title}</AppText>
      {children}
    </View>
  );
}

type Props = {
  value: MealFormState;
  onChange: (patch: Partial<MealFormState>) => void;
  allIngredients: IngredientRow[];
};

export function MealFormFields({ value, onChange, allIngredients }: Props) {
  const set = <K extends keyof MealFormState>(key: K, v: MealFormState[K]) => onChange({ [key]: v } as Partial<MealFormState>);

  const updateProcedureStep = (index: number, text: string) => {
    set("procedure", value.procedure.map((step, i) => (i === index ? text : step)));
  };
  const removeProcedureStep = (index: number) => {
    set("procedure", value.procedure.filter((_, i) => i !== index));
  };

  // tags holds two independent groups of values merged into one array —
  // toggling one group must never clobber the other's current selection.
  const setTagGroup = (groupIds: Set<string>, next: string[]) => {
    set("tags", [...value.tags.filter((t) => !groupIds.has(t)), ...next]);
  };

  return (
    <View>
      <Section title="Basic Info">
        <TextField label="Meal name" value={value.name} onChangeText={(v) => set("name", v)} />
        <TextField label="Description" value={value.description} onChangeText={(v) => set("description", v)} multiline />
      </Section>

      <Section title="Timing & Details">
        <TextField label="Prep time (min)" value={value.prepTime} onChangeText={(v) => set("prepTime", v)} keyboardType="numeric" />
        <TextField label="Total time (min)" value={value.totalTime} onChangeText={(v) => set("totalTime", v)} keyboardType="numeric" />
        <TextField label="Serving size" value={value.servingSize} onChangeText={(v) => set("servingSize", v)} keyboardType="numeric" />
        <TextField label="Protein type (e.g. chicken, vegetarian)" value={value.proteinType} onChangeText={(v) => set("proteinType", v)} />
        <AppText variant="caption">Difficulty</AppText>
        <ChipSelect mode="single" options={DIFFICULTY_OPTIONS} value={value.difficulty} onChange={(v) => set("difficulty", v)} />
      </Section>

      <Section title="Source & Pricing">
        <TextField label="Restaurant (fast food only)" value={value.restaurant} onChangeText={(v) => set("restaurant", v)} />
        <TextField label="Source URL" value={value.source} onChangeText={(v) => set("source", v)} autoCapitalize="none" />
        <TextField label="Budget range (e.g. 100-150)" value={value.budgetRange} onChangeText={(v) => set("budgetRange", v)} />
      </Section>

      <Section title="Procedure">
        <View className="gap-2 mb-2">
          {value.procedure.map((step, index) => (
            <View key={index} className="flex-row items-center gap-2">
              <View className="flex-1">
                <TextField
                  label={`Step ${index + 1}`}
                  value={step}
                  onChangeText={(v) => updateProcedureStep(index, v)}
                  multiline
                />
              </View>
              <Pressable onPress={() => removeProcedureStep(index)} className="h-9 w-9 items-center justify-center">
                <Trash2 color={colors.like} size={18} />
              </Pressable>
            </View>
          ))}
        </View>
        <Button label="+ Add step" variant="outline" onPress={() => set("procedure", [...value.procedure, ""])} />
      </Section>

      <Section title="Ingredients">
        <SeedMealIngredientsEditor items={value.ingredients} allIngredients={allIngredients} onChange={(v) => set("ingredients", v)} />
      </Section>

      <Section title="Tags & Dietary">
        <AppText variant="caption">Dietary tags</AppText>
        <ChipSelect mode="multi" options={DIETARY_TAG_OPTIONS} value={value.dietaryTags} onChange={(v) => set("dietaryTags", v)} />

        <AppText variant="caption">Nutrition &amp; style tags</AppText>
        <AppText variant="caption" className="text-ink-subtle -mt-2">
          Auto-recalculated from the meal's macros whenever totals are recomputed — edit here only to override.
        </AppText>
        <ChipSelect
          mode="multi"
          options={PILL_TAG_OPTIONS}
          value={value.tags.filter((t) => PILL_TAG_IDS.has(t))}
          onChange={(v) => setTagGroup(PILL_TAG_IDS, v)}
        />

        <AppText variant="caption">Way of cooking</AppText>
        <ChipSelect
          mode="multi"
          options={COOKING_METHOD_OPTIONS}
          value={value.tags.filter((t) => COOKING_METHOD_IDS.has(t))}
          onChange={(v) => setTagGroup(COOKING_METHOD_IDS, v)}
        />

        <AppText variant="caption">Allergens</AppText>
        <ChipSelect mode="multi" options={ALLERGEN_OPTIONS} value={value.allergens} onChange={(v) => set("allergens", v)} />
      </Section>
    </View>
  );
}
