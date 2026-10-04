import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRight, Info, Lightbulb, ShoppingCart } from "lucide-react-native";
import { Spinner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { usePantry } from "@/frontend/core/pantry/hooks/usePantry";
import { useSavedGroceryList } from "@/frontend/core/grocery/hooks/useSavedGroceryList";
import { usePlanGroceryList } from "@/frontend/core/grocery/hooks/usePlanGroceryList";
// The one link into the Meal Planner: the grocery sheet's "Meal plan" tab
// shows here only when the user has built a plan.
import { usePlannerStore } from "@/frontend/features/meal-planner/store/usePlannerStore";
import { useCountUp } from "../../hooks/useCountUp";
import { GroceryRow, formatPeso } from "@/frontend/core/grocery/components/GroceryRow";
import { FullGroceryListSheet } from "@/frontend/core/grocery/components/FullGroceryListSheet";

const PREVIEW_LIMIT = 7;

function SummaryRow({ dotClassName, label, count }: { dotClassName: string; label: string; count: number }) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <View className={`h-2 w-2 rounded-full ${dotClassName}`} />
        <Text className="font-inter-regular text-body text-web-ink-body">{label}</Text>
      </View>
      <Text className="font-inter-semibold text-body text-web-ink">{count}</Text>
    </View>
  );
}

// Owner-only: one shopping list built from every saved home-cooked meal,
// a preview of up to 7 items (rest in a sheet), and a summary.
export function GroceryTab({ userId }: { userId: string | null }) {
  const grocery = useSavedGroceryList(userId);
  const plan = usePlannerStore((s) => s.plan);
  const isPremium = usePlannerStore((s) => s.isPremium);
  const planDays = useMemo(() => (isPremium ? [0, 1, 2, 3, 4] : [0]), [isPremium]);
  const planGrocery = usePlanGroceryList(plan, planDays, !!plan);
  const { data: pantry = [] } = usePantry();
  const [fullOpen, setFullOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const { items } = grocery;
  const mainCount = items.filter((item) => item.category === "main").length;
  // Only main ingredients count toward the total (pantry staples are
  // usually on hand).
  const { total } = grocery;
  const shownTotal = useCountUp(total);

  // Leaving the tab sends any pending checkbox changes.
  const { flush } = grocery;
  useEffect(() => () => void flush(), [flush]);

  return (
    <View className="gap-4 pb-6">
      <View className="p-3">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="font-inter-semibold text-body text-web-ink">Grocery Preview</Text>
              {items.length > 0 && (
                <View className="rounded-full bg-web-divider px-1.5 py-0.5">
                  <Text className="font-inter-medium text-sub text-web-ink-muted">
                    {items.length} item{items.length === 1 ? "" : "s"}
                  </Text>
                </View>
              )}
              <Pressable onPress={() => setInfoOpen((open) => !open)} hitSlop={8} accessibilityLabel="About Grocery Preview">
                <Info color={colors.webInk.muted} size={16} />
              </Pressable>
            </View>
            <Text className="mt-0.5 font-inter-regular text-small text-web-ink-body">
              Here's what you need to buy to cook all your saved meals.
            </Text>
          </View>
          {total > 0 && (
            <View className="items-end">
              <Text className="w-[50px] text-right font-inter-regular text-small text-web-ink-body">Total cost</Text>
              <Text className="font-inter-semibold text-body text-brand-green">~₱{formatPeso(shownTotal, 0)}</Text>
            </View>
          )}
        </View>

        {infoOpen && (
          <View className="mt-2 rounded-xl border border-web-divider bg-white p-3">
            <Text className="font-inter-semibold text-small text-web-ink">Grocery Preview</Text>
            <Text className="mt-0.5 font-inter-regular text-small text-web-ink-muted">
              Ingredients are automatically gathered from your saved meals, ready for your grocery run.
            </Text>
          </View>
        )}

        {grocery.loading ? (
          <View className="items-center py-10">
            <Spinner size={20} color={colors.brandGreen.DEFAULT} trackColor={colors.webDivider} />
          </View>
        ) : items.length === 0 ? (
          <View className="items-center gap-1.5 py-10">
            <ShoppingCart color={colors.brandGreen.DEFAULT} size={26} />
            <Text className="font-inter-bold text-body text-web-ink-soft">Your list is empty</Text>
            <Text className="max-w-[200px] text-center font-inter-regular text-small text-web-ink-muted">
              Save home-cooked meals and your ingredients will appear here automatically.
            </Text>
          </View>
        ) : (
          <View className="mt-3 px-3">
            {items.slice(0, PREVIEW_LIMIT).map((item, i, shown) => (
              <GroceryRow
                key={item.id}
                item={item}
                checked={grocery.isChecked(item)}
                onToggle={() => grocery.toggle(item)}
                isLast={i === shown.length - 1}
              />
            ))}
          </View>
        )}

        {/* Full list: when the preview is cut off, or there's a meal plan
            (its list lives in the sheet's "Meal plan" tab). */}
        {!grocery.loading && (items.length > PREVIEW_LIMIT || !!plan) && (
          <Pressable onPress={() => setFullOpen(true)} className="mt-2 h-[30px] flex-row items-center justify-center gap-1">
            <Text className="font-inter-medium text-small text-brand-green">View Grocery List</Text>
            <ChevronRight color={colors.brandGreen.DEFAULT} size={15} />
          </Pressable>
        )}
      </View>

      <View className="gap-3">
        <Text className="font-inter-semibold text-body text-web-ink-body">Shopping Summary</Text>
        {items.length === 0 ? (
          <Text className="font-inter-regular text-body text-web-ink-muted">Save home-cooked meals to see your grocery summary.</Text>
        ) : (
          <>
            <View className="gap-3 rounded-2xl border border-web-divider p-4">
              <View>
                <Text className="font-inter-bold text-heading text-web-ink">₱{formatPeso(total, 0)}</Text>
                <Text className="font-inter-regular text-small text-web-ink-muted">Estimated total for main ingredients</Text>
              </View>
              <View className="h-px bg-web-divider" />
              <SummaryRow dotClassName="bg-brand-green" label="Main ingredients" count={mainCount} />
              <SummaryRow dotClassName="bg-web-ink-faint" label="Pantry items" count={items.length - mainCount} />
            </View>
            <View className="rounded-2xl bg-notice-bg p-4">
              <View className="flex-row items-center gap-1.5">
                <Lightbulb color={colors.notice.icon} size={14} />
                <Text className="font-inter-semibold text-body text-web-ink">Tips</Text>
              </View>
              <Text className="mt-1 font-inter-regular text-small text-web-ink-body">
                Prices are estimates based on ingredient quantities used. Actual spend may be higher since some items are sold
                as whole units.
              </Text>
            </View>
          </>
        )}
      </View>

      <FullGroceryListSheet
        visible={fullOpen}
        onClose={() => {
          setFullOpen(false);
          void grocery.flush();
        }}
        initialTab="saved"
        tabs={[
          {
            key: "saved",
            label: "Saved meals",
            items,
            total,
            isChecked: grocery.isChecked,
            onToggle: grocery.toggle,
            emptyText: "Save home-cooked meals and their ingredients will show up here.",
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
    </View>
  );
}
