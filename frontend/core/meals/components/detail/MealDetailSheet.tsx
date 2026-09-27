import { ReactNode, useEffect, useState } from "react";
import { BottomSheet } from "@/frontend/components/ui";
import { MealDetailContent } from "./MealDetailContent";
import type { MealType } from "../../mealTypes";

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
};

export function MealDetailSheet({ meal, onClose, onClosed, onEdit, onArchive, onDelete, overlay }: MealDetailSheetProps) {
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

  useEffect(() => {
    if (meal) {
      setRenderedMeal(meal);
      setIsSaved(false);
      setHistory([]);
      setDirection("none");
    }
  }, [meal]);

  // Tapping a related meal swaps the sheet's content without closing it.
  const handleSelectMeal = (next: MealType) => {
    if (renderedMeal) setHistory((prev) => [...prev, renderedMeal]);
    setDirection("forward");
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
    <BottomSheet visible={!!meal} onClose={onClose} onClosed={onClosed} handleClassName="bg-white/70" overlay={overlay}>
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
        />
      )}
    </BottomSheet>
  );
}
