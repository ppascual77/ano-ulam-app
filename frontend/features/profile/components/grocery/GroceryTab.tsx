import { useIsPro } from "@/frontend/core/pro/store/useProStore";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { router } from "expo-router";
import { ChevronRight, Lightbulb, ShoppingCart, Utensils } from "lucide-react-native";
import { AppText, Spinner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { usePantry } from "@/frontend/core/pantry/hooks/usePantry";
import { useSavedGroceryList } from "@/frontend/core/grocery/hooks/useSavedGroceryList";
import { usePlanGroceryList } from "@/frontend/core/grocery/hooks/usePlanGroceryList";
// The one link into the Meal Planner: the grocery sheet's "Meal plan" tab
// shows here only when the user has built a plan.
import { usePlannerStore } from "@/frontend/features/meal-planner/store/usePlannerStore";
import { useSavedMealPlan } from "@/frontend/features/meal-planner/hooks/useSavedMealPlan";
import { useCountUp } from "../../hooks/useCountUp";
import { EmptyState } from "../EmptyState";
import { GroceryRow, formatPeso } from "@/frontend/core/grocery/components/GroceryRow";
import { FullGroceryListSheet } from "@/frontend/core/grocery/components/FullGroceryListSheet";
import { GrocerySectionHeader, splitGroceryItems } from "@/frontend/core/grocery/components/GrocerySection";

const PREVIEW_LIMIT = 7;

function SummaryRow({ dotClassName, label, count }: { dotClassName: string; label: string; count: number }) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <View className={`h-2 w-2 rounded-full ${dotClassName}`} />
        <Text className="font-inter-regular text-body text-ink">{label}</Text>
      </View>
      <Text className="font-inter-semibold text-body text-ink-emphasis">{count}</Text>
    </View>
  );
}

// Owner-only: one shopping list built from every saved home-cooked meal,
// a preview of up to 7 items (rest in a sheet), and a summary.
export function GroceryTab({ userId }: { userId: string | null }) {
  const grocery = useSavedGroceryList(userId);
  // Loads the account's saved plan, so its tab shows here without opening
  // the planner first.
  useSavedMealPlan();
  const plan = usePlannerStore((s) => s.plan);
  const isPremium = useIsPro();
  const length = plan?.days.length ?? 0;
  const planDays = useMemo(() => (isPremium ? Array.from({ length }, (_, i) => i) : [0]), [isPremium, length]);
  const planGrocery = usePlanGroceryList(plan, planDays, !!plan, userId);
  const { data: pantry = [] } = usePantry();
  const [fullOpen, setFullOpen] = useState(false);

  const { items } = grocery;
  const { mains, staples } = splitGroceryItems(items);
  // The preview's first items (mains come first), split the same way. The
  // headers count the whole list, not just what's previewed.
  const preview = splitGroceryItems(items.slice(0, PREVIEW_LIMIT));
  // Only main ingredients count toward the total (pantry staples are
  // usually on hand).
  const { total } = grocery;
  const shownTotal = useCountUp(total);

  // Leaving the tab sends any pending checkbox changes.
  const { flush } = grocery;
  const { flush: flushPlan } = planGrocery;
  useEffect(
    () => () => {
      void flush();
      void flushPlan();
    },
    [flush, flushPlan],
  );

  return (
    <View className="gap-4 pb-6">
      <View className="p-3">
        {/* Dotted title (and item count) like the other profile tabs, with
            the estimated total big on the right. */}
        <View className="flex-row items-end justify-between gap-3">
          <View className="flex-1 flex-row items-baseline gap-1.5">
            <AppText variant="sectionSubtitle" dot>
              Grocery preview
            </AppText>
            {items.length > 0 && <Text className="font-inter-semibold text-body text-ink-subtle">{items.length}</Text>}
          </View>
          {total > 0 && (
            <View className="items-end">
              <Text className="font-inter-medium text-small text-ink-subtle">Total cost</Text>
              <Text className="font-inter-extrabold text-heading tracking-display text-primary">
                ~₱{formatPeso(shownTotal, 0)}
              </Text>
            </View>
          )}
        </View>

        {grocery.loading ? (
          <View className="items-center py-10">
            <Spinner size={20} color={colors.primary} trackColor={colors.webDivider} />
          </View>
        ) : items.length === 0 ? (
          // The same empty state as the other profile tabs.
          <EmptyState
            Icon={ShoppingCart}
            iconColor={colors.accent}
            title="Your list is empty"
            body="Save home-cooked meals and their ingredients will show up here automatically."
            action={{ label: "Explore Meals", Icon: Utensils, onPress: () => router.navigate("/browse") }}
          />
        ) : (
          // The whole preview opens the full list (its rows aren't checked
          // off here).
          <Pressable
            onPress={() => setFullOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="View grocery list"
            className="mt-3 gap-4 rounded-2xl border-2 border-dashed border-accent px-3 pb-1 pt-4"
          >
            {[
              { title: "To buy", rows: preview.mains, count: mains.length },
              { title: "Pantry staples", rows: preview.staples, count: staples.length },
            ]
              .filter((section) => section.rows.length > 0)
              .map((section) => (
                <View key={section.title}>
                  <GrocerySectionHeader title={section.title} count={section.count} />
                  {section.rows.map((item) => (
                    <GroceryRow
                      key={item.id}
                      item={item}
                      checked={grocery.isChecked(item)}
                      onToggle={() => grocery.toggle(item)}
                      preview
                    />
                  ))}
                </View>
              ))}
            <View className="h-[30px] flex-row items-center justify-center gap-1">
              <Text className="font-inter-medium text-small text-primary">View Grocery List</Text>
              <ChevronRight color={colors.primary} size={15} />
            </View>
          </Pressable>
        )}
      </View>

      {/* Only once there's a list: empty, the empty state above says it all. */}
      {items.length > 0 && (
        <View className="gap-3">
          <Text className="font-inter-semibold text-body text-ink">Shopping Summary</Text>
          <View className="gap-3 rounded-2xl border border-ink-emphasis/10 p-4">
            <View>
              <Text className="font-inter-bold text-heading text-ink-emphasis">₱{formatPeso(total, 0)}</Text>
              <Text className="font-inter-regular text-small text-ink-subtle">Estimated total for main ingredients</Text>
            </View>
            <View className="h-px bg-ink-emphasis/5" />
            <SummaryRow dotClassName="bg-primary" label="To buy" count={mains.length} />
            <SummaryRow dotClassName="bg-ink-placeholder" label="Pantry staples" count={staples.length} />
          </View>
          <View className="rounded-2xl bg-notice-bg p-4">
            <View className="flex-row items-center gap-1.5">
              <Lightbulb color={colors.notice.icon} size={14} />
              <Text className="font-inter-semibold text-body text-ink-emphasis">Tips</Text>
            </View>
            <Text className="mt-1 font-inter-regular text-small text-ink">
              Prices are estimates based on ingredient quantities used. Actual spend may be higher since some items are sold
              as whole units.
            </Text>
          </View>
        </View>
      )}

      <FullGroceryListSheet
        visible={fullOpen}
        onClose={() => {
          setFullOpen(false);
          void grocery.flush();
          void planGrocery.flush();
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
