import { View, Pressable, Text } from "react-native";
import { Plus, Trash2 } from "lucide-react-native";
import { AppText, Button, ChipSelect, TextField } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { IngredientRow } from "@/api/ingredients";
import { PILL_TAG_IDS, PILL_TAG_OPTIONS } from "../utils/pillTags";
import { SeedMealIngredientsEditor, type PendingMealIngredient } from "./SeedMealIngredientsEditor";
import { FieldLabel } from "./AdminUi";

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

// A form section: dotted title (and an optional one-line hint), then its
// fields. Sections are separated by a rule so long forms scan in blocks.
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View className="mb-8 gap-4 border-t border-ink-emphasis/10 pt-6">
      <View className="gap-1">
        <AppText variant="sectionSubtitle" dot>
          {title}
        </AppText>
        {hint && <Text className="font-inter-regular text-body text-ink-subtle">{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

// Two fields side by side.
function Pair({ children }: { children: [React.ReactNode, React.ReactNode] }) {
  return (
    <View className="flex-row gap-3">
      <View className="flex-1">{children[0]}</View>
      <View className="flex-1">{children[1]}</View>
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
      <Section title="Basic info" hint="What people see first on the meal card.">
        <TextField label="Meal name" value={value.name} onChangeText={(v) => set("name", v)} />
        <TextField label="Description" value={value.description} onChangeText={(v) => set("description", v)} multiline />
      </Section>

      <Section title="Timing & details">
        <Pair>
          <TextField label="Prep time (min)" value={value.prepTime} onChangeText={(v) => set("prepTime", v)} keyboardType="numeric" />
          <TextField label="Total time (min)" value={value.totalTime} onChangeText={(v) => set("totalTime", v)} keyboardType="numeric" />
        </Pair>
        <Pair>
          <TextField label="Serving size" value={value.servingSize} onChangeText={(v) => set("servingSize", v)} keyboardType="numeric" />
          <TextField label="Protein type" value={value.proteinType} onChangeText={(v) => set("proteinType", v)} />
        </Pair>
        <View className="gap-2">
          <FieldLabel>Difficulty</FieldLabel>
          <ChipSelect mode="single" options={DIFFICULTY_OPTIONS} value={value.difficulty} onChange={(v) => set("difficulty", v)} />
        </View>
      </Section>

      <Section title="Source & pricing">
        <TextField label="Restaurant (fast food only)" value={value.restaurant} onChangeText={(v) => set("restaurant", v)} />
        <TextField label="Source URL" value={value.source} onChangeText={(v) => set("source", v)} autoCapitalize="none" />
        <TextField label="Budget range (e.g. 100-150)" value={value.budgetRange} onChangeText={(v) => set("budgetRange", v)} />
      </Section>

      <Section title="Procedure" hint={`${value.procedure.length} step${value.procedure.length === 1 ? "" : "s"}`}>
        <View className="gap-3">
          {value.procedure.map((step, index) => (
            <View key={index} className="flex-row items-start gap-3">
              {/* Step number, like the meal detail's steps timeline. */}
              <View className="mt-4 h-7 w-7 items-center justify-center rounded-full bg-primary">
                <Text className="font-inter-bold text-small text-white">{index + 1}</Text>
              </View>
              <View className="flex-1">
                <TextField
                  label={`Step ${index + 1}`}
                  value={step}
                  onChangeText={(v) => updateProcedureStep(index, v)}
                  multiline
                />
              </View>
              <Pressable
                onPress={() => removeProcedureStep(index)}
                accessibilityLabel={`Remove step ${index + 1}`}
                className="mt-2.5 h-9 w-9 items-center justify-center rounded-full active:bg-like-soft"
              >
                <Trash2 color={colors.like} size={18} />
              </Pressable>
            </View>
          ))}
        </View>
        <Button
          label="Add step"
          variant="outline"
          icon={<Plus color={colors.primary} size={18} strokeWidth={2.5} />}
          onPress={() => set("procedure", [...value.procedure, ""])}
        />
      </Section>

      <Section title="Ingredients" hint="Link every line to an ingredient record so its price and macros count.">
        <SeedMealIngredientsEditor items={value.ingredients} allIngredients={allIngredients} onChange={(v) => set("ingredients", v)} />
      </Section>

      <Section title="Tags & dietary">
        <View className="gap-2">
          <FieldLabel>Dietary tags</FieldLabel>
          <ChipSelect mode="multi" options={DIETARY_TAG_OPTIONS} value={value.dietaryTags} onChange={(v) => set("dietaryTags", v)} />
        </View>

        <View className="gap-2">
          <FieldLabel hint="Auto-recalculated from the meal's macros whenever totals are recomputed — edit here only to override.">
            Nutrition & style tags
          </FieldLabel>
          <ChipSelect
            mode="multi"
            options={PILL_TAG_OPTIONS}
            value={value.tags.filter((t) => PILL_TAG_IDS.has(t))}
            onChange={(v) => setTagGroup(PILL_TAG_IDS, v)}
          />
        </View>

        <View className="gap-2">
          <FieldLabel>Way of cooking</FieldLabel>
          <ChipSelect
            mode="multi"
            options={COOKING_METHOD_OPTIONS}
            value={value.tags.filter((t) => COOKING_METHOD_IDS.has(t))}
            onChange={(v) => setTagGroup(COOKING_METHOD_IDS, v)}
          />
        </View>

        <View className="gap-2">
          <FieldLabel>Allergens</FieldLabel>
          <ChipSelect mode="multi" options={ALLERGEN_OPTIONS} value={value.allergens} onChange={(v) => set("allergens", v)} />
        </View>
      </Section>
    </View>
  );
}
