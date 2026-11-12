import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type ScrollViewInstance } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Animated, { Easing, FadeIn, LayoutAnimationConfig, withTiming } from "react-native-reanimated";
import { X } from "lucide-react-native";
import {
  AppText,
  Button,
  ConfirmSheet,
  DotMorphButton,
  LoadingState,
  Screen,
  showGlobalToast,
} from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useAuth, useSignIn } from "@/frontend/features/auth/hooks/useAuth";
import { SignInPrompt } from "@/frontend/features/auth/components/SignInPrompt";
import { RecipeLimitSheet } from "@/frontend/features/profile/components/created/RecipeLimitSheet";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { compressImageForUpload } from "@/frontend/features/admin/utils/imageCompression";
import { countMyRecipes, RECIPE_LIMIT, submitRecipe, type RecipeSubmission } from "@/api/recipes";
import { getIngredientsForMatching } from "@/api/meals";
import { draftTags } from "../utils/draftToMeal";
import {
  displayQuantity,
  hasContent,
  servingsCount,
  validateDetails,
  validateIngredients,
  validateSteps,
  type RecipeDraft,
  type StepErrors,
} from "../types";
import { useRecipeDraft } from "../hooks/useRecipeDraft";
import { RecipeSubmittedView } from "../components/RecipeSubmittedView";
import { StepProgress } from "../components/StepProgress";
import { DetailsStep } from "../components/DetailsStep";
import { IngredientsStep } from "../components/IngredientsStep";
import { StepsStep } from "../components/StepsStep";
import { ReviewStep } from "../components/ReviewStep";
import { RecipePreviewSheet } from "../components/RecipePreviewSheet";
import { RecipeCostSummary } from "../components/RecipeCostSummary";

const STEPS = ["Details", "Ingredients", "Steps", "Review"];
const LAST = STEPS.length - 1;
const VALIDATORS: ((draft: RecipeDraft) => StepErrors)[] = [validateDetails, validateIngredients, validateSteps, () => ({})];
const isValid = (step: number, draft: RecipeDraft) => Object.keys(VALIDATORS[step](draft)).length === 0;

// Step changes: the new step slides 16px in from the side you're heading
// and fades in (fade only with Reduce motion).
const SLIDE = 16;
const EASE = Easing.out(Easing.cubic);

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

// "2 hours ago" for the resume prompt.
function timeAgo(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

// Add a Recipe: Details -> Ingredients -> Steps -> Review, submitted as a
// pending meal for admin review. Opened from Discover's Create sheet and
// Profile. The draft autosaves on the device (useRecipeDraft): reopening
// offers to continue it, and ✕ asks Save draft / Discard once anything is
// typed. Finished steps can be revisited from the progress bar.
export default function AddRecipeScreen() {
  const { session } = useAuth();
  const posterId = session?.user.id ?? null;
  const signIn = useSignIn();
  const reduceMotion = useReduceMotion();
  const queryClient = useQueryClient();

  const { draft, setDraft, step, setStep, status, saved, resume, startOver, clear } = useRecipeDraft(posterId, LAST);
  const [direction, setDirection] = useState(1);
  const [showErrors, setShowErrors] = useState(false);
  // Failed-Next count, so invalid fields shake again on every attempt.
  const [attempt, setAttempt] = useState(0);
  // Paused while a step is being dragged, so scrolling and dragging don't fight.
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [askClose, setAskClose] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Set once Submit has morphed into its dot, which hands over to the
  // Submitted screen's medallion.
  const [submitted, setSubmitted] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  // Where to go once the open sheet has finished closing (leaving the screen
  // with a native Modal still up can strand an overlay over the app).
  const exitAfterSheet = useRef<null | "back" | "recipes">(null);
  const [limitOpen, setLimitOpen] = useState(true);
  const leaveAfterSheet = () => {
    const to = exitAfterSheet.current;
    exitAfterSheet.current = null;
    if (!to) return;
    router.back();
    if (to === "recipes") router.navigate({ pathname: "/profile", params: { tab: "recipes", at: String(Date.now()) } });
  };

  // Never carry a paused scroll into another step (e.g. if a drag's "ended"
  // signal got lost), or the next long page can't scroll.
  useEffect(() => setScrollEnabled(true), [step]);
  const handleDragging = useCallback((dragging: boolean) => setScrollEnabled(!dragging), []);

  const { data: recipeCount, isLoading: countLoading } = useQuery({
    queryKey: ["recipes", "mine", "count", posterId],
    queryFn: () => countMyRecipes(posterId as string),
    enabled: !!posterId,
  });

  // A restored draft's ingredient rows are a snapshot from when it was
  // saved: swap in the current catalog rows once, so prices are today's.
  const { data: catalog } = useQuery({
    queryKey: ["ingredients", "matching"],
    queryFn: getIngredientsForMatching,
    staleTime: 10 * 60 * 1000,
  });
  const refreshed = useRef(false);
  useEffect(() => {
    if (refreshed.current || !catalog || status !== "ready") return;
    refreshed.current = true;
    const byId = new Map(catalog.map((row) => [row.id, row]));
    setDraft((prev) =>
      prev.ingredients.some((l) => l.ingredient)
        ? { ...prev, ingredients: prev.ingredients.map((l) => (l.ingredient ? { ...l, ingredient: byId.get(l.ingredient.id) ?? l.ingredient } : l)) }
        : prev,
    );
  }, [catalog, status, setDraft]);

  const submit = useMutation({
    mutationFn: async () => {
      const cover = draft.coverPhotoUri ? await compressImageForUpload(draft.coverPhotoUri) : null;
      return submitRecipe(toSubmission(draft, cover), posterId);
    },
    onSuccess: () => {
      clear();
      queryClient.invalidateQueries({ queryKey: ["admin", "recipes"] });
      queryClient.invalidateQueries({ queryKey: ["recipes", "mine"] });
    },
    // A toast up top, where it's seen (the button turns into "Try again").
    onError: () => showGlobalToast({ tone: "error", message: "Couldn't submit your recipe. Check your connection and try again." }),
  });

  const errors = showErrors ? VALIDATORS[step](draft) : {};
  const update = (patch: Partial<RecipeDraft>) => setDraft((prev) => ({ ...prev, ...patch }));

  const goTo = (target: number) => {
    setDirection(target > step ? 1 : -1);
    setShowErrors(false);
    setStep(target);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  // Back to any earlier step, or forward to one whose earlier steps are all
  // filled in.
  const canJumpTo = (target: number) => target < step || STEPS.slice(0, target).every((_, i) => isValid(i, draft));

  const next = () => {
    if (!isValid(step, draft)) {
      setShowErrors(true);
      setAttempt((n) => n + 1);
      return;
    }
    if (step < LAST) goTo(step + 1);
  };

  const close = () => {
    if (!submitted && hasContent(draft)) setAskClose(true);
    else router.back();
  };

  // A new ingredient lands at the bottom, often under the keyboard: bring it
  // into view once its quantity box has focus (and the keyboard is up).
  const scrollToNewLine = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 350);
  }, []);

  const stepEntering = useMemo(() => {
    if (reduceMotion) return FadeIn.duration(180);
    const dx = direction * SLIDE;
    return () => {
      "worklet";
      return {
        initialValues: { opacity: 0, transform: [{ translateX: dx }] },
        animations: {
          opacity: withTiming(1, { duration: 240 }),
          transform: [{ translateX: withTiming(0, { duration: 280, easing: EASE }) }],
        },
      };
    };
  }, [direction, reduceMotion]);

  const title = draft.name.trim() || "Add a Recipe";
  const header = (
    <View className="flex-row items-center gap-2 px-5 pb-3 pt-2">
      <Pressable
        onPress={close}
        disabled={submit.isPending}
        className="h-9 w-9 items-center justify-center"
        accessibilityLabel="Close"
      >
        <X color={colors.ink.emphasis} size={20} />
      </Pressable>
      <AppText variant="heading" numberOfLines={1} className="flex-1">
        {title}
      </AppText>
    </View>
  );

  // ---- blocked states ----------------------------------------------------

  if (!posterId) {
    return (
      <Screen padded={false}>
        {header}
        <View className="flex-1 justify-center pb-12">
          <SignInPrompt
            art={require("@/assets/onboarding/slide-7.gif")}
            title="Share your recipe"
            description="Sign in to share your recipes with the community and see what they cost to cook."
            onSignIn={(provider) => signIn.mutate(provider)}
            signingIn={signIn.isPending}
          />
        </View>
      </Screen>
    );
  }

  if (countLoading || status === "loading") {
    return (
      <Screen padded={false}>
        {header}
        <LoadingState />
      </Screen>
    );
  }

  if (!submit.isSuccess && (recipeCount ?? 0) >= RECIPE_LIMIT) {
    return (
      <Screen padded={false}>
        {header}
        <RecipeLimitSheet
          visible={limitOpen}
          onClose={() => {
            exitAfterSheet.current = "back";
            setLimitOpen(false);
          }}
          onClosed={leaveAfterSheet}
          action={{
            label: "See my recipes",
            onPress: () => {
              exitAfterSheet.current = "recipes";
              setLimitOpen(false);
            },
          }}
        />
      </Screen>
    );
  }

  if (submitted) {
    return (
      <Screen padded={false}>
        <Animated.View entering={FadeIn.duration(200)} className="flex-1">
          <RecipeSubmittedView recipeName={draft.name} onDone={() => router.back()} />
        </Animated.View>
      </Screen>
    );
  }

  // ---- the form ----------------------------------------------------------

  return (
    <Screen padded={false} dismissKeyboardOnTap={false}>
      {header}
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View className="px-5 pb-4">
          <StepProgress steps={STEPS} current={step} canJumpTo={canJumpTo} onJump={goTo} reduceMotion={reduceMotion} />
        </View>

        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerClassName="px-5 pb-8"
          keyboardShouldPersistTaps="handled"
          // Replaces Screen's tap-to-dismiss (turned off below so it can't
          // swallow swipes): the keyboard closes when you start scrolling.
          keyboardDismissMode="on-drag"
          scrollEnabled={scrollEnabled}
        >
          {/* Keyed by step, so each change plays the slide-in (not on first open). */}
          <LayoutAnimationConfig skipEntering>
            <Animated.View key={step} entering={stepEntering}>
              {step === 0 && <DetailsStep draft={draft} onChange={update} errors={errors} shakeKey={attempt} />}
              {step === 1 && (
                <IngredientsStep draft={draft} onChange={update} errors={errors} shakeKey={attempt} onLineAdded={scrollToNewLine} />
              )}
              {step === 2 && <StepsStep draft={draft} onChange={update} errors={errors} onDraggingChange={handleDragging} />}
              {step === 3 && <ReviewStep draft={draft} onViewDetails={() => setPreviewOpen(true)} reduceMotion={reduceMotion} />}
            </Animated.View>
          </LayoutAnimationConfig>
        </ScrollView>

        {/* The running total: the cost coming together as lines are added. */}
        {step === 1 && <RecipeCostSummary draft={draft} />}

        <View className={`flex-row gap-3 px-5 py-3 ${step === 1 && draft.ingredients.length > 0 ? "" : "border-t border-ink-emphasis/10"}`}>
          {step > 0 && (
            <View className="flex-1">
              <Button label="Back" variant="outline" onPress={() => goTo(step - 1)} disabled={submit.isPending || submit.isSuccess} />
            </View>
          )}
          <View className="flex-1">
            {step === LAST ? (
              // Pressed, it uploads (spinner); once the recipe is in, it
              // shrinks into a dot that hands over to the Submitted medallion.
              <DotMorphButton
                label={submit.isError ? "Try again" : "Submit for review"}
                loading={submit.isPending}
                trigger={submit.isSuccess}
                onPress={() => submit.mutate()}
                onDone={() => setSubmitted(true)}
                reduceMotion={reduceMotion}
              />
            ) : (
              <Button label="Next" onPress={next} />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <RecipePreviewSheet draft={draft} visible={previewOpen} onClose={() => setPreviewOpen(false)} />

      {/* Reopened with a saved draft. A stray tap outside keeps it. */}
      <ConfirmSheet
        visible={status === "resume"}
        tone="primary"
        title={`Continue your ${saved?.draft.name.trim() || "recipe"}?`}
        body={saved ? `You last worked on it ${timeAgo(saved.savedAt)}.` : undefined}
        confirmLabel="Continue"
        cancelLabel="Start over"
        onConfirm={resume}
        onCancel={startOver}
        onDismiss={resume}
      />

      {/* ✕ with something typed. A stray tap outside just stays. */}
      <ConfirmSheet
        visible={askClose}
        tone="primary"
        title="Save as a draft?"
        body="Finish it anytime: it'll be here when you come back to Add a Recipe."
        confirmLabel="Save draft"
        cancelLabel="Discard"
        onConfirm={() => {
          exitAfterSheet.current = "back";
          setAskClose(false);
        }}
        onCancel={() => {
          clear();
          exitAfterSheet.current = "back";
          setAskClose(false);
        }}
        onDismiss={() => setAskClose(false)}
        onClosed={leaveAfterSheet}
      />
    </Screen>
  );
}
