import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, X } from "lucide-react-native";
import { AppText, Button, LoadingState, Screen } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { compressImageForUpload } from "@/frontend/features/admin/utils/imageCompression";
import { countMyRecipes, RECIPE_LIMIT, submitRecipe, type RecipeSubmission } from "@/api/recipes";
import { draftTags } from "../utils/draftToMeal";
import {
  displayQuantity,
  EMPTY_DRAFT,
  servingsCount,
  validateDetails,
  validateIngredients,
  validateSteps,
  type RecipeDraft,
  type StepErrors,
} from "../types";
import { StepProgress } from "../components/StepProgress";
import { DetailsStep } from "../components/DetailsStep";
import { IngredientsStep } from "../components/IngredientsStep";
import { StepsStep } from "../components/StepsStep";
import { PreviewStep } from "../components/PreviewStep";
import { IngredientDetailSheet } from "@/frontend/core/meals/components/detail/IngredientDetailSheet";
import type { IngredientType } from "@/frontend/core/meals/mealTypes";
import { PublishStep } from "../components/PublishStep";

const STEPS = ["Details", "Ingredients", "Steps", "Preview", "Publish"];
const VALIDATORS: ((draft: RecipeDraft) => StepErrors)[] = [
  validateDetails,
  validateIngredients,
  validateSteps,
  () => ({}),
  () => ({}),
];

function toSubmission(draft: RecipeDraft, coverPhotoUri: string | null): RecipeSubmission {
  const { tags, dietaryTags } = draftTags(draft);
  return {
    name: draft.name,
    description: draft.description,
    coverPhotoUri,
    prepTimeMinutes: Number(draft.prepTime),
    servings: servingsCount(draft),
    difficulty: draft.difficulty,
    tags,
    dietaryTags,
    steps: draft.steps,
    ingredients: draft.ingredients.map((line) => {
      const quantity_amount = line.unit === "to taste" ? null : Number(line.amount);
      const quantity_unit = line.unit === "to taste" ? null : line.unit;
      return line.ingredient
        ? { kind: "linked", ingredient_id: line.ingredient.id, display_text: displayQuantity(line), quantity_amount, quantity_unit }
        : { kind: "unlinked", name: line.name, display_text: displayQuantity(line), quantity_amount, quantity_unit };
    }),
  };
}

// Add a Recipe: a 5-step form (same steps as the web app's
// CreateRecipeFlow) that submits the recipe as a pending meal for admin
// review. Opened from Discover's Create sheet.
export default function AddRecipeScreen() {
  const { session } = useAuth();
  const posterId = session?.user.id ?? null;
  // Google sign-in can't complete in Expo Go on a physical device (Supabase
  // redirect bug), so dev builds may submit without an account to test the
  // flow end to end. Production requires a session.
  const canSubmitWithoutAccount = __DEV__;

  const [draft, setDraft] = useState<RecipeDraft>(EMPTY_DRAFT);
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  // Failed-Next count, so invalid fields shake again on every attempt.
  const [attempt, setAttempt] = useState(0);
  // Paused while a step is being dragged, so scrolling and dragging don't fight.
  const [scrollEnabled, setScrollEnabled] = useState(true);
  // Never carry a paused scroll into another step (e.g. if a drag's "ended"
  // signal got lost), or the next long page (Preview) can't scroll.
  useEffect(() => setScrollEnabled(true), [step]);
  const handleDragging = useCallback((dragging: boolean) => setScrollEnabled(!dragging), []);
  // Ingredient tapped in the Preview step's meal details.
  const [previewIngredient, setPreviewIngredient] = useState<IngredientType | null>(null);
  const queryClient = useQueryClient();

  const { data: recipeCount, isLoading: countLoading } = useQuery({
    queryKey: ["recipes", "mine", "count", posterId],
    queryFn: () => countMyRecipes(posterId as string),
    enabled: !!posterId,
  });

  const submit = useMutation({
    mutationFn: async () => {
      const cover = draft.coverPhotoUri ? await compressImageForUpload(draft.coverPhotoUri) : null;
      return submitRecipe(toSubmission(draft, cover), posterId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "recipes"] });
      queryClient.invalidateQueries({ queryKey: ["recipes", "mine"] });
    },
  });

  const errors = showErrors ? VALIDATORS[step](draft) : {};
  const update = (patch: Partial<RecipeDraft>) => setDraft((prev) => ({ ...prev, ...patch }));

  const next = () => {
    if (Object.keys(VALIDATORS[step](draft)).length > 0) {
      setShowErrors(true);
      setAttempt((n) => n + 1);
      return;
    }
    setShowErrors(false);
    if (step < STEPS.length - 1) setStep(step + 1);
    else submit.mutate();
  };

  const back = () => {
    setShowErrors(false);
    if (step > 0) setStep(step - 1);
    else router.back();
  };

  const header = (
    <View className="flex-row items-center gap-2 px-5 pb-3 pt-2">
      <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center" accessibilityLabel="Close">
        <X color={colors.ink.emphasis} size={20} />
      </Pressable>
      <AppText variant="heading">Add a Recipe</AppText>
    </View>
  );

  // ---- blocked states ----------------------------------------------------

  if (!posterId && !canSubmitWithoutAccount) {
    return (
      <Screen padded={false}>
        {header}
        <View className="flex-1 items-center justify-center px-8">
          <AppText variant="body" className="text-center">
            Sign in to share your recipes with the community.
          </AppText>
        </View>
      </Screen>
    );
  }

  if (posterId && countLoading) {
    return (
      <Screen padded={false}>
        {header}
        <LoadingState />
      </Screen>
    );
  }

  if ((recipeCount ?? 0) >= RECIPE_LIMIT) {
    return (
      <Screen padded={false}>
        {header}
        <View className="flex-1 items-center justify-center px-8">
          <AppText variant="body" className="text-center">
            You've reached the {RECIPE_LIMIT}-recipe limit. Remove an existing recipe to publish a new one.
          </AppText>
        </View>
      </Screen>
    );
  }

  if (submit.isSuccess) {
    return (
      <Screen padded={false}>
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <CheckCircle2 color={colors.primary} size={48} />
          <AppText variant="heading" className="text-center">
            Submitted for review
          </AppText>
          <AppText variant="body" className="text-center">
            Thanks for sharing {draft.name}! We'll review it and it'll show up for everyone once approved.
          </AppText>
          <View className="mt-2 w-full">
            <Button label="Done" onPress={() => router.back()} />
          </View>
        </View>
      </Screen>
    );
  }

  // ---- the form ----------------------------------------------------------

  return (
    <Screen padded={false} dismissKeyboardOnTap={false}>
      {header}
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View className="px-5 pb-4">
          <StepProgress steps={STEPS} current={step} />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pb-8"
          keyboardShouldPersistTaps="handled"
          // Replaces Screen's tap-to-dismiss (turned off below so it can't
          // swallow swipes): the keyboard closes when you start scrolling.
          keyboardDismissMode="on-drag"
          scrollEnabled={scrollEnabled}
        >
          {step === 0 && <DetailsStep draft={draft} onChange={update} errors={errors} shakeKey={attempt} />}
          {step === 1 && <IngredientsStep draft={draft} onChange={update} errors={errors} shakeKey={attempt} />}
          {step === 2 && (
            <StepsStep draft={draft} onChange={update} errors={errors} onDraggingChange={handleDragging} />
          )}
          {step === 3 && <PreviewStep draft={draft} onSelectIngredient={setPreviewIngredient} />}
          {step === 4 && <PublishStep draft={draft} onViewDetails={() => setStep(3)} />}

          {submit.isError && (
            <AppText variant="caption" className="mt-4 text-center text-like">
              Couldn't submit your recipe. Please try again.
            </AppText>
          )}
        </ScrollView>

        <View className="flex-row gap-3 border-t border-ink-emphasis/10 px-5 py-3">
          <View className="flex-1">
            <Button label={step === 0 ? "Cancel" : "Back"} variant="outline" onPress={back} disabled={submit.isPending} />
          </View>
          <View className="flex-1">
            <Button
              label={step === STEPS.length - 1 ? (submit.isPending ? "Submitting..." : "Submit for review") : "Next"}
              onPress={next}
              disabled={submit.isPending}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Same ingredient sheet as the real meal details, over this screen. */}
      <IngredientDetailSheet
        ingredient={previewIngredient}
        onClose={() => setPreviewIngredient(null)}
        maxHeightPercent={0.6}
      />
    </Screen>
  );
}
