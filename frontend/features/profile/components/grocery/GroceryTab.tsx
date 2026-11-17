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
import { GroceryMealPicker } from "@/frontend/core/grocery/components/GroceryMealPicker";
import { GrocerySectionHeader } from "@/frontend/core/grocery/components/GrocerySection";
import { groupGroceryItems } from "@/frontend/core/grocery/utils/groupGroceryItems";

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
  // To buy (and bought), and what's already at home: the same split as the
  // full list. The preview shows the first few of each; the headers count
  // the whole list.
  const groups = groupGroceryItems(items, pantry, grocery.stateOf);
  const shopping = [...groups.toBuy, ...groups.gotIt];
  const previewShopping = shopping.slice(0, PREVIEW_LIMIT);
  const previewHome = groups.atHome.slice(0, Math.max(0, PREVIEW_LIMIT - previewShopping.length));
  // What this list buys: things already at home aren't counted.
  const { total } = groups;
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
        ) : items.length === 0 && grocery.picker.meals.length > 0 ? (
          // Saved meals, but none switched on: pick some in the full list.
          <Pressable
            onPress={() => setFullOpen(true)}
            accessibilityRole="button"
            className="mt-3 items-center gap-1 rounded-2xl border-2 border-dashed border-accent px-4 py-6 active:opacity-70"
          >
            <Text className="font-inter-semibold text-body text-ink-emphasis">No meals on your list</Text>
            <Text className="text-center font-inter-regular text-small text-ink-subtle">
              Pick the saved meals you&apos;re cooking and their ingredients show up here.
            </Text>
            <View className="mt-2 flex-row items-center gap-1">
              <Text className="font-inter-medium text-small text-primary">Pick meals</Text>
              <ChevronRight color={colors.primary} size={15} />
            </View>
          </Pressable>
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
              { title: "To buy", rows: previewShopping, count: shopping.length, home: false },
              { title: "At home", rows: previewHome, count: groups.atHome.length, home: true },
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
                      atHome={section.home}
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
              <Text className="font-inter-regular text-small text-ink-subtle">Estimated total, minus what's at home</Text>
            </View>
            <View className="h-px bg-ink-emphasis/5" />
            <SummaryRow dotClassName="bg-primary" label="To buy" count={groups.toBuy.length} />
            <SummaryRow dotClassName="bg-ink-placeholder" label="At home" count={groups.atHome.length} />
          </View>
          <View className="rounded-2xl bg-notice-bg p-4">
            <View className="flex-row items-center gap-1.5">
              <Lightbulb color={colors.notice.icon} size={14} />
              <Text className="font-inter-semibold text-body text-ink-emphasis">Tips</Text>
            </View>
            <Text className="mt-1 font-inter-regular text-small text-ink">
              Packaged items are priced as whole packs. Anything you tick goes to your pantry, so it won&apos;t be counted
              next time.
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
            stateOf: grocery.stateOf,
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
                  stateOf: planGrocery.stateOf,
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
