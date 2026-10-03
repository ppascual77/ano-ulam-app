import { MealCardSkeleton } from "@/frontend/core/meals/components/card/MealCardSkeleton";
import { MealGrid } from "./MealGrid";

const PLACEHOLDERS = ["a", "b", "c", "d"];

// Four grid-sized MealCard placeholders, laid out like the real grid.
export function MealGridSkeleton() {
  return (
    <MealGrid
      items={PLACEHOLDERS}
      keyOf={(key) => key}
      renderItem={(_, width) => <MealCardSkeleton width={width} layout="grid" />}
    />
  );
}
