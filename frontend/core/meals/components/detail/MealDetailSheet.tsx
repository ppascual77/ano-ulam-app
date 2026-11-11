import { ReactNode, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Sparkles } from "lucide-react-native";
import { BottomSheet, ConfirmSheet } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useSavedMealActions } from "@/frontend/core/saved/hooks/useSavedMeals";
import { MealDetailContent } from "./MealDetailContent";
import { IngredientDetailSheet } from "./IngredientDetailSheet";
import { ProPage } from "@/frontend/core/pro/components/ProPage";
import { GlobalLoginGate } from "@/frontend/features/auth/components/GlobalLoginGate";
import { SaveLimitSheet } from "@/frontend/core/saved/components/SaveLimitSheet";
import { useLoginGateStore } from "@/frontend/features/auth/store/useLoginGateStore";
import type { IngredientType, MealType } from "../../mealTypes";

// The meal detail is full screen; the ingredient sheet tops out at 75% of
// it, so it reads as a sheet on top rather than a second full screen.
const INGREDIENT_SHEET_HEIGHT_PERCENT = 0.75;

// Shortest time the Save/Unsave button shows its spinner.
const MIN_BUSY_MS = 500;

type MealDetailSheetProps = {
  /** null closes the sheet. */
  meal: MealType | null;
  onClose: () => void;
  /** Fires once this sheet's close animation has actually finished — see
   *  BottomSheet's onClosed. Admin callers use this to sequence opening a
   *  second sheet (e.g. a delete confirmation) right after this one
   *  closes, so the two are never both visible at once. */
  onClosed?: () => void;
  /** Admin-only actions — omitted for every consumer-facing usage (Home,
   *  Browse, MealList), which renders nothing extra for them. Manage
   *  Meals passes these to get Edit/Archive/Delete in the same sheet
   *  everyone already taps a meal card to open. */
  onEdit?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  /** Passed straight through to BottomSheet's own overlay slot — see there
   *  for why (React Native doesn't reliably stack two native Modals). */
  overlay?: ReactNode;
  /** Admin review actions (see MealDetailContent's `review`). */
  review?: { onApprove: () => void; onReject: () => void; busy?: boolean };
  /** The viewer's own recipe (see MealDetailContent's `recipeOwner`).
   *  Applies to `meal` only. */
  recipeOwner?: { onEditRecipe: () => void; onDeleteRecipe: () => void };
  /** Toasts from the save footer: the saved meals limit, a failed save, and
   *  "{name} updated" after a servings update. Callers without a Toast can
   *  leave it out. */
  onNotify?: (message: string, tone: "success" | "error") => void;
  /** From Pantry results: the pantry's ingredient ids, for "You have it" /
   *  "To buy" on `meal`'s ingredients (not on related meals opened from it). */
  pantryIds?: Set<string>;
};

export function MealDetailSheet({
  meal,
  onClose,
  onClosed,
  onEdit,
  onArchive,
  onDelete,
  overlay,
  review,
  recipeOwner,
  onNotify,
  pantryIds,
}: MealDetailSheetProps) {
  // Keep the last meal rendered while the sheet animates closed, so the
  // content doesn't flash empty before it's off-screen.
  const [renderedMeal, setRenderedMeal] = useState(meal);
  const savedMeals = useSavedMealActions();
  const savedEntry = savedMeals.savedFor(renderedMeal);
  // Servings picked for "Update Meal", awaiting the confirm. null = closed.
  const [pendingServings, setPendingServings] = useState<number | null>(null);
  const [updating, setUpdating] = useState(false);
  // Meals visited via "related meals", most recent last — lets the back
  // button return to whatever the user originally opened.
  const [history, setHistory] = useState<MealType[]>([]);
  // Which way the content should slide in: "none" for the initial open
  // (the sheet's own slide-up already covers that), "forward" for picking
  // a related meal, "back" for the back button.
  const [direction, setDirection] = useState<"none" | "forward" | "back">("none");
  // The ingredient whose detail sheet is open on top of this one, already
  // scaled to the servings shown when it was tapped. null = closed.
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientType | null>(null);
  // Locked micronutrients (meal or ingredient) tapped by a free user open
  // the full Pro page straight away: in this sheet's overlay, since a /pro
  // screen would open behind it.
  const [proPageOpen, setProPageOpen] = useState(false);

  // While open, a guest's login sheet shows inside this one (its overlay)
  // instead of as a second Modal from the app root.
  const open = !!meal;
  useEffect(() => {
    if (!open) return;
    const { addHost, removeHost } = useLoginGateStore.getState();
    addHost();
    return removeHost;
  }, [open]);

  useEffect(() => {
    if (meal) {
      setRenderedMeal(meal);
      setHistory([]);
      setDirection("none");
    }
    // A new meal, or this sheet closing, also closes any open ingredient.
    setSelectedIngredient(null);
  }, [meal]);

  // Tapping a related meal swaps the sheet's content without closing it.
  const handleSelectMeal = (next: MealType) => {
    if (renderedMeal) setHistory((prev) => [...prev, renderedMeal]);
    setDirection("forward");
    setSelectedIngredient(null);
    setRenderedMeal(next);
  };

  const handleBack = () => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      setDirection("back");
      setRenderedMeal(prev[prev.length - 1]);
      return next;
    });
  };

  const notify = (error: string | null) => {
    if (error) onNotify?.(error, "error");
  };

  // The meal whose save/unsave request is still in flight, so its button
  // shows a spinner (the bookmark flips optimistically before that). Held
  // for at least MIN_BUSY_MS so the spinner (and the confetti after it)
  // reads as a real save even when the request is instant.
  const [busyMeal, setBusyMeal] = useState<MealType | null>(null);
  const track = (target: MealType, request: Promise<string | null>) => {
    setBusyMeal(target);
    const minBusy = new Promise((resolve) => setTimeout(resolve, MIN_BUSY_MS));
    // Save/unsave errors are toasted by the saved actions themselves.
    void Promise.all([request, minBusy]).then(() => {
      setBusyMeal((current) => (current === target ? null : current));
    });
  };

  const confirmUpdate = async () => {
    if (!renderedMeal || !savedEntry || pendingServings == null) return;
    setUpdating(true);
    const error = await savedMeals.updateServings(savedEntry, renderedMeal, pendingServings);
    setUpdating(false);
    setPendingServings(null);
    if (error) return notify(error);
    onNotify?.(`${renderedMeal.name} updated`, "success");
    onClose();
  };

  // The top-left arrow (and Android's back button) steps back through
  // related meals first, and closes once it's back at the meal opened.
  const handleBackOrClose = history.length > 0 ? handleBack : onClose;

  return (
    <BottomSheet
      visible={!!meal}
      onClose={handleBackOrClose}
      onClosed={onClosed}
      fullScreen
      // The ingredient sheet goes in this sheet's own overlay, not a second
      // native Modal (see BottomSheet's `overlay`). A caller's overlay (e.g.
      // a confetti burst) still renders above it.
      overlay={
        <>
          <IngredientDetailSheet
            ingredient={selectedIngredient}
            onClose={() => setSelectedIngredient(null)}
            maxHeightPercent={INGREDIENT_SHEET_HEIGHT_PERCENT}
            onLockedPro={() => setProPageOpen(true)}
          />
          <ConfirmSheet
            presentation="inline"
            visible={pendingServings != null}
            icon={
              <View className="h-12 w-12 items-center justify-center rounded-full bg-info-soft">
                <Sparkles color={colors.info} size={20} />
              </View>
            }
            title="Update servings?"
            body={
              <Text className="mt-1 text-center font-inter-regular text-body text-web-ink-muted">
                Changing the servings for <Text className="font-inter-medium text-web-ink-soft">{renderedMeal?.name}</Text> will
                recalculate its ingredient quantities. Any Grocery List items affected by this change will be unchecked so you
                know to restock the right amount.
              </Text>
            }
            confirmLabel={updating ? "Updating…" : "Update"}
            tone="primary"
            busy={updating}
            onCancel={() => setPendingServings(null)}
            onConfirm={confirmUpdate}
          />
          {/* A guest saving from here: the login sheet inside this one. */}
          {meal && <GlobalLoginGate presentation="inline" />}
          {/* Saving past the free cap from here: the Pro pitch inside this
              sheet, and its Unlock Pro opens the Pro page in this sheet too. */}
          {meal && <SaveLimitSheet presentation="inline" onOpenPro={() => setProPageOpen(true)} />}
          {/* Above the ingredient sheet, which can open it too. */}
          <BottomSheet visible={proPageOpen} onClose={() => setProPageOpen(false)} presentation="inline" fullScreen>
            {/* No Settings link: it would navigate under this sheet. */}
            <ProPage
              allowLinks={false}
              title={
                <>
                  Know what&apos;s in <Text className="text-brand-orange">every</Text> meal
                </>
              }
              subtitle="Pro shows fiber, sugar and sodium for every meal and ingredient, measured against a day's recommended amount."
              onClose={() => setProPageOpen(false)}
              onStarted={() => setProPageOpen(false)}
            />
          </BottomSheet>
          {overlay}
          {/* White status bar over the photo while open. As an element (not
              setStatusBarStyle) it restores whatever style was there before
              on close, e.g. light again over Discover's reel. */}
          {meal && <StatusBar style="light" />}
        </>
      }
    >
      {renderedMeal && (
        <MealDetailContent
          key={renderedMeal.id}
          meal={renderedMeal}
          initialServings={savedEntry?.serving_size}
          saved={{
            isSaved: !!savedEntry,
            savedServings: savedEntry?.serving_size,
            busy: busyMeal === renderedMeal,
            onSave: (servings) => track(renderedMeal, savedMeals.save(renderedMeal, servings)),
            onUnsave: () => savedEntry && track(renderedMeal, savedMeals.unsave(savedEntry)),
            onUpdate: setPendingServings,
          }}
          recipeOwner={meal && renderedMeal.id === meal.id ? recipeOwner : undefined}
          pantryIds={meal && renderedMeal.id === meal.id ? pantryIds : undefined}
          onSelectMeal={handleSelectMeal}
          onBack={handleBackOrClose}
          direction={direction}
          onEdit={onEdit}
          onArchive={onArchive}
          onDelete={onDelete}
          onSelectIngredient={setSelectedIngredient}
          onLockedPro={() => setProPageOpen(true)}
          review={review}
        />
      )}
    </BottomSheet>
  );
}
