import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui";
import { MealDetailContent } from "./MealDetailContent";
import type { MealType } from "../../mealTypes";

type MealDetailSheetProps = {
  /** null closes the sheet. */
  meal: MealType | null;
  onClose: () => void;
};

export function MealDetailSheet({ meal, onClose }: MealDetailSheetProps) {
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
    <BottomSheet visible={!!meal} onClose={onClose} handleClassName="bg-white/70">
      {renderedMeal && (
        <MealDetailContent
          key={renderedMeal.id}
          meal={renderedMeal}
          isSaved={isSaved}
          onSave={() => setIsSaved((prev) => !prev)}
          onSelectMeal={handleSelectMeal}
          onBack={history.length > 0 ? handleBack : undefined}
          direction={direction}
        />
      )}
    </BottomSheet>
  );
}
