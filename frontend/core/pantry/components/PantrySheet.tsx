import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, { SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from "react-native-reanimated";
import { ArrowLeft, Check, X } from "lucide-react-native";
import { AppText, BottomSheet, Button, SearchBar } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { IngredientSearch } from "@/frontend/core/meals/components/IngredientSearch";
import { INGREDIENT_CATEGORY_ICONS } from "@/frontend/core/meals/ingredientCategory";
import { usePantry, usePantryActions } from "../hooks/usePantry";
import { usePantryStaples } from "../hooks/usePantryStaples";

export const PANTRY_SUBTITLE = "Add what you have, we'll find what you can cook.";

// Add Ingredients: search the ingredient catalog, or "View all" the common
// pantry staples to tick off the basics at once. Edits apply to the shared
// pantry list right away (see usePantryActions). Used from Home's By Pantry
// and Profile's Pantry tab.
// Switching views swipes like a navigation push: View all slides the
// staples in from the right (the main view leaves to the left); back
// reverses it. Both views animate at once, stacked in the same space.
const SWIPE_MS = 280;
// Plain style, not a className, on the animated views (NativeWind can knock
// out Reanimated styles on re-render).
const FILL = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } as const;

export function PantrySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [view, setView] = useState<"add" | "staples">("add");
  // Only swipe when switching views, not when the sheet first opens.
  const [switched, setSwitched] = useState(false);
  // Every open starts on the main view.
  useEffect(() => {
    if (visible) {
      setView("add");
      setSwitched(false);
    }
  }, [visible]);
  const go = (next: "add" | "staples") => {
    setSwitched(true);
    setView(next);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} heightPercent={0.8}>
      <View className="flex-1 overflow-hidden">
        {view === "add" ? (
          <Animated.View
            key="add"
            style={FILL}
            entering={switched ? SlideInLeft.duration(SWIPE_MS) : undefined}
            exiting={SlideOutLeft.duration(SWIPE_MS)}
          >
            <AddView onDone={onClose} onViewStaples={() => go("staples")} />
          </Animated.View>
        ) : (
          <Animated.View key="staples" style={FILL} entering={SlideInRight.duration(SWIPE_MS)} exiting={SlideOutRight.duration(SWIPE_MS)}>
            <StaplesView onBack={() => go("add")} />
          </Animated.View>
        )}
      </View>
    </BottomSheet>
  );
}

function Header({ title, subtitle, onBack }: { title: string; subtitle: string; onBack?: () => void }) {
  return (
    <View className="flex-row items-center gap-3">
      {onBack && (
        <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Back">
          <ArrowLeft color={colors.webInk.DEFAULT} size={20} />
        </Pressable>
      )}
      <View className="flex-1">
        <AppText variant="sectionTitle" dot>{title}</AppText>
        <Text className="mt-0.5 font-inter-regular text-small text-web-ink-muted">{subtitle}</Text>
      </View>
    </View>
  );
}

// Search, the common-condiments shortcut, and what's been added so far.
function AddView({ onDone, onViewStaples }: { onDone: () => void; onViewStaples: () => void }) {
  const { data: pantry = [] } = usePantry();
  const actions = usePantryActions();
  const { staples } = usePantryStaples();
  const addedIds = useMemo(() => new Set(pantry.map((item) => item.id)), [pantry]);

  return (
    <View className="flex-1">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 px-5 pb-4 pt-10">
        <Header title="Add Ingredients" subtitle="What do you have?" />

        <IngredientSearch
          placeholder="Search ingredient…"
          disabledIds={addedIds}
          onPick={(ingredient) => actions.add({ id: ingredient.id, name: ingredient.canonical_name })}
        />

        {staples.length > 0 && (
          <View className="flex-row items-center gap-3 rounded-2xl border border-primary/10 bg-primary/5 p-4">
            <Image source={INGREDIENT_CATEGORY_ICONS.condiments} style={{ width: 40, height: 40 }} />
            <View className="flex-1">
              <Text className="font-inter-semibold text-body text-web-ink">Add common condiments</Text>
              <Text className="mt-0.5 font-inter-regular text-small text-web-ink-muted">Quickly add the basics you usually have</Text>
            </View>
            <Pressable onPress={onViewStaples} className="rounded-full border border-primary px-3 py-1.5 active:bg-primary/5">
              <Text className="font-inter-semibold text-small text-primary">View all</Text>
            </Pressable>
          </View>
        )}

        {pantry.length > 0 && (
          <View className="gap-2">
            <Text className="font-inter-regular text-small text-web-ink-muted">
              {pantry.length} ingredient{pantry.length === 1 ? "" : "s"} added
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {pantry.map((item) => (
                <View key={item.id} className="flex-row items-center gap-1.5 rounded-full border border-brand-green px-3 py-1.5">
                  <Text className="font-inter-light text-small text-brand-green">{item.name}</Text>
                  <Pressable onPress={() => actions.remove(item.id)} hitSlop={8} accessibilityLabel={`Remove ${item.name}`}>
                    <X color={colors.brandGreen.DEFAULT} size={11} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View className="px-5 pb-4 pt-2">
        <Button label="Done" onPress={onDone} />
      </View>
    </View>
  );
}

// The staples as a checklist, all pre-checked: untick what you don't have.
// "Add pantry staples" adds the ticked ones and removes unticked ones that
// were already in the pantry, so the list matches what was confirmed.
function StaplesView({ onBack }: { onBack: () => void }) {
  const { data: pantry = [] } = usePantry();
  const actions = usePantryActions();
  const { staples } = usePantryStaples();
  const [query, setQuery] = useState("");
  const [unchecked, setUnchecked] = useState<Set<string>>(() => new Set());

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? staples.filter((s) => s.label.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) : staples;
  }, [staples, query]);

  const toggle = (id: string) =>
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = () => {
    const inPantry = new Set(pantry.map((p) => p.id));
    for (const staple of staples) {
      if (unchecked.has(staple.id)) {
        if (inPantry.has(staple.id)) actions.remove(staple.id);
      } else if (!inPantry.has(staple.id)) {
        actions.add({ id: staple.id, name: staple.name });
      }
    }
    onBack();
  };

  return (
    <View className="flex-1">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 px-5 pb-4 pt-10">
        <Header title="Common pantry staples" subtitle="Select which do you have" onBack={onBack} />
        <SearchBar placeholder="Search ingredient…" value={query} onChangeText={setQuery} onClear={() => setQuery("")} />

        <View>
          {shown.map((staple, i) => {
            const checked = !unchecked.has(staple.id);
            return (
              <Pressable
                key={staple.id}
                onPress={() => toggle(staple.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                className={`flex-row items-center gap-3 py-3 px-5 ${i === shown.length - 1 ? "" : "border-b border-web-divider"}`}
              >
                <View
                  className={`h-[22px] w-[22px] items-center justify-center rounded-md border-2 ${
                    checked ? "border-brand-green bg-brand-green" : "border-web-ink-faint bg-white"
                  }`}
                >
                  {checked && <Check color={colors.white} size={14} strokeWidth={3} />}
                </View>
                <Text className="font-inter-regular text-body text-web-ink">{staple.label}</Text>
              </Pressable>
            );
          })}
          {shown.length === 0 && (
            <Text className="py-6 text-center font-inter-regular text-body text-web-ink-faint">No staples match "{query}"</Text>
          )}
        </View>
      </ScrollView>

      <View className="px-5 pb-4 pt-2">
        <Button label="Add pantry staples" onPress={apply} />
      </View>
    </View>
  );
}
