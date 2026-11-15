import { useEffect, useMemo, useState } from "react";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";
import { usePantry } from "@/frontend/core/pantry/hooks/usePantry";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { usePlannerStore } from "@/frontend/features/meal-planner/store/usePlannerStore";
import { useSavedMealPlan } from "@/frontend/features/meal-planner/hooks/useSavedMealPlan";
import { useSavedGroceryList } from "../hooks/useSavedGroceryList";
import { usePlanGroceryList } from "../hooks/usePlanGroceryList";
import { closeGroceryList, useGrocerySheetStore } from "../store/useGrocerySheetStore";
import { FullGroceryListSheet } from "./FullGroceryListSheet";
import { GroceryMealPicker } from "./GroceryMealPicker";

// The grocery list sheet opened from anywhere (openGroceryList): Home's cart
// button, a save toast's "View list". Mounted once in app/_layout.tsx. The
// lists only load while it's open (and until its close animation ends), so
// their checkbox state is read fresh on every open.
export function GroceryListSheetHost() {
  const open = useGrocerySheetStore((s) => s.open);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);
  if (!mounted) return null;
  return <GroceryListSheet visible={open} onClosed={() => setMounted(false)} />;
}

// The same two lists as Profile's Grocery tab: saved meals, and the meal
// plan once there is one.
function GroceryListSheet({ visible, onClosed }: { visible: boolean; onClosed: () => void }) {
  const userId = useAuth().session?.user.id ?? null;
  const grocery = useSavedGroceryList(userId);
  useSavedMealPlan();
  const plan = usePlannerStore((s) => s.plan);
  const isPro = useIsPro();
  const length = plan?.days.length ?? 0;
  const planDays = useMemo(() => (isPro ? Array.from({ length }, (_, i) => i) : [0]), [isPro, length]);
  const planGrocery = usePlanGroceryList(plan, planDays, !!plan, userId);
  const { data: pantry = [] } = usePantry();

  const close = () => {
    closeGroceryList();
    void grocery.flush();
    void planGrocery.flush();
  };

  return (
    <FullGroceryListSheet
      visible={visible}
      onClose={close}
      onClosed={onClosed}
      initialTab="saved"
      tabs={[
        {
          key: "saved",
          label: "Saved meals",
          items: grocery.items,
          total: grocery.total,
          isChecked: grocery.isChecked,
          onToggle: grocery.toggle,
          emptyText:
            grocery.picker.meals.length > 0
              ? "Pick the meals you're cooking above and their ingredients show up here."
              : "Save home-cooked meals and their ingredients will show up here.",
          header: <GroceryMealPicker picker={grocery.picker} />,
        },
        ...(plan
          ? [
              {
                key: "plan",
                label: "Meal plan",
                items: planGrocery.items,
                total: planGrocery.total,
                isChecked: planGrocery.isChecked,
                onToggle: planGrocery.toggle,
                emptyText: "Your meal plan's ingredients will show up here.",
              },
            ]
          : []),
      ]}
      pantry={pantry}
    />
  );
}
