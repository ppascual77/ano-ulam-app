import { ReactNode, useEffect, useState } from "react";
import { BottomSheet } from "@/frontend/components/ui";
import { MealDetailContent } from "./MealDetailContent";
import { IngredientDetailSheet } from "./IngredientDetailSheet";
import type { IngredientType, MealType } from "../../mealTypes";

// Explicit (it's also BottomSheet's default) because the ingredient sheet's
// max height is derived from it.
const MEAL_SHEET_HEIGHT_PERCENT = 0.8;
// The ingredient sheet tops out at 75% of the meal sheet, so it reads as a
// smaller sheet on top rather than a second full-height one.
const INGREDIENT_SHEET_HEIGHT_PERCENT = MEAL_SHEET_HEIGHT_PERCENT * 0.75;

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
  /** Controlled like for the meal opened (see MealDetailContent's `like`).
   *  Applies to `meal` only, not related meals browsed to from inside. */
  like?: { liked: boolean; count: number; onToggle: () => void };
  /** Admin review actions (see MealDetailContent's `review`). */
  review?: { onApprove: () => void; onReject: () => void; busy?: boolean };
};

export function MealDetailSheet({
  meal,
  onClose,
  onClosed,
  onEdit,
  onArchive,
  onDelete,
  overlay,
  like,
  review,
}: MealDetailSheetProps) {
  // Keep the last meal rendered while the sheet animates closed, so the
  // content doesn't flash empty before it's off-screen.
  const [renderedMeal, setRenderedMeal] = useState(meal);
  const [isSaved, setIsSaved] = useState(false);
  // Meals visited via "related meals", most recent last — lets the back
  // button return to whatever the user originally opened.
  const [history, setHistory] = useState<MealType[]>([]);
  // Which way the content should slide in: "none" for the initial open
  // (BottomSheet's own slide-up already covers that), "forward" for picking
  // a related meal, "back" for the back button.
  const [direction, setDirection] = useState<"none" | "forward" | "back">("none");
  // The ingredient whose detail sheet is open on top of this one, already
  // scaled to the servings shown when it was tapped. null = closed.
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientType | null>(null);

  useEffect(() => {
    if (meal) {
      setRenderedMeal(meal);
      setIsSaved(false);
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
    setIsSaved(false);
  };

  const handleBack = () => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      setDirection("back");
      setRenderedMeal(prev[prev.length - 1]);
      setIsSaved(false);
      return next;
    });
  };

  return (
    <BottomSheet
      visible={!!meal}
      onClose={onClose}
      heightPercent={MEAL_SHEET_HEIGHT_PERCENT}
      onClosed={onClosed}
      handleClassName="bg-white/70"
      // The ingredient sheet goes in this sheet's own overlay, not a second
      // native Modal (see BottomSheet's `overlay`). A caller's overlay (e.g.
      // a confetti burst) still renders above it.
      overlay={
        <>
          <IngredientDetailSheet
            ingredient={selectedIngredient}
            onClose={() => setSelectedIngredient(null)}
            maxHeightPercent={INGREDIENT_SHEET_HEIGHT_PERCENT}
          />
          {overlay}
        </>
      }
    >
      {renderedMeal && (
        <MealDetailContent
          key={renderedMeal.id}
          meal={renderedMeal}
          isSaved={isSaved}
          onSave={() => setIsSaved((prev) => !prev)}
          onSelectMeal={handleSelectMeal}
          onBack={history.length > 0 ? handleBack : undefined}
          direction={direction}
          onEdit={onEdit}
          onArchive={onArchive}
          onDelete={onDelete}
          onSelectIngredient={setSelectedIngredient}
          like={meal && renderedMeal?.id === meal.id ? like : undefined}
          review={review}
        />
      )}
    </BottomSheet>
  );
}
