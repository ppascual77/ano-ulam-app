import { useIsPro } from "@/frontend/core/pro/store/useProStore";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRight, Lightbulb, ShoppingCart } from "lucide-react-native";
import { AppText, Spinner } from "@/frontend/components/ui";
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
import { GrocerySectionHeader, splitGroceryItems } from "@/frontend/core/grocery/components/GrocerySection";

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
  const isPremium = useIsPro();
  const planDays = useMemo(() => (isPremium ? [0, 1, 2, 3, 4] : [0]), [isPremium]);
  const planGrocery = usePlanGroceryList(plan, planDays, !!plan);
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
  useEffect(() => () => void flush(), [flush]);

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
              <Text className="font-inter-medium text-small text-brand-green">View Grocery List</Text>
              <ChevronRight color={colors.brandGreen.DEFAULT} size={15} />
            </View>
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
              <SummaryRow dotClassName="bg-brand-green" label="To buy" count={mains.length} />
              <SummaryRow dotClassName="bg-web-ink-faint" label="Pantry staples" count={staples.length} />
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
