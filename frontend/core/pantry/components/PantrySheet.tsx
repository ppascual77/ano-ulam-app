import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, type ScrollViewInstance, Text, View, type ViewInstance } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { BottomSheet, Button, RollingText, SearchBar } from "@/frontend/components/ui";
import type { IngredientRow } from "@/api/ingredients";
import { INGREDIENT_CATEGORY_ICONS } from "@/frontend/core/meals/ingredientCategory";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { usePantry, usePantryActions } from "../hooks/usePantry";
import { useIngredientCatalog, usePantryStaples } from "../hooks/usePantryStaples";
import { usePantryGroups, usePantryMatches } from "../hooks/usePantryMatches";
import { useRecentlyRemovedStore } from "../store/useRecentlyRemovedStore";
import { pantryGroupOf, type PantryGroup } from "../pantryGroups";
import { pantryName } from "../pantryName";
import { PANTRY_MIN_FOR_SUGGESTIONS, type PantryIngredient } from "../types";
import { ChipFace, PantryChip } from "./PantryChip";
import { PantrySearchResults, QuickAddChips, type PickOrigin } from "./PantrySearch";
import { PantryStaplesView } from "./PantryStaplesView";
import { CountLabel } from "./CountLabel";
import { SheetHeader } from "./SheetHeader";

// Add Ingredients: search the ingredient catalog (or tap a quick add), or
// "View all" the common pantry staples to tick off the basics at once.
// Edits apply to the shared pantry list right away (see usePantryActions).
// Used from Home's By Pantry and Profile's Pantry tab.
// Switching views swipes like a navigation push: View all slides the
// staples in from the right (the main view leaves to the left); back
// reverses it. Both views animate at once, stacked in the same space.
const SWIPE_MS = 280;
// Plain style, not a className, on the animated views (NativeWind can knock
// out Reanimated styles on re-render).
const FILL = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } as const;

type PantrySheetProps = {
  visible: boolean;
  onClose: () => void;
  /** The footer's "Show N meals": the host closes the sheet and opens the
   *  results once it's gone (see onClosed). */
  onShowMeals: () => void;
  onClosed?: () => void;
};

export function PantrySheet({ visible, onClose, onShowMeals, onClosed }: PantrySheetProps) {
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
    <BottomSheet visible={visible} onClose={onClose} onClosed={onClosed} heightPercent={0.8}>
      <View className="flex-1 overflow-hidden">
        {view === "add" ? (
          <Animated.View
            key="add"
            style={FILL}
            entering={switched ? SlideInLeft.duration(SWIPE_MS) : undefined}
            exiting={SlideOutLeft.duration(SWIPE_MS)}
          >
            <AddView onDone={onClose} onShowMeals={onShowMeals} onViewStaples={() => go("staples")} />
          </Animated.View>
        ) : (
          <Animated.View key="staples" style={FILL} entering={SlideInRight.duration(SWIPE_MS)} exiting={SlideOutRight.duration(SWIPE_MS)}>
            <PantryStaplesView onBack={() => go("add")} />
          </Animated.View>
        )}
      </View>
    </BottomSheet>
  );
}

// ---- The add flight -------------------------------------------------------
// The signature moment: the picked item lifts off its row as a chip and
// arcs into the tray's first slot (x eases across while y rises early, so
// the path curves), then the real chip takes its place with a light tap.
const FLIGHT_MS = 350;
// The chip face's padding before its name (pl-3.5, py-2), so the flying
// chip's name starts right where the tapped name was.
const FACE_INSET = { x: 14, y: 8 };
// The tray's left padding (px-5): where its first chip sits.
const TRAY_INSET = 20;
// Chips the folded tray shows before "+N more".
const TRAY_PEEK = 4;

type Flight = { id: string; name: string; group: PantryGroup; from: { x: number; y: number }; to: { x: number; y: number } };

function Flyer({ flight, onLand }: { flight: Flight; onLand: (id: string) => void }) {
  const x = useSharedValue(flight.from.x);
  const y = useSharedValue(flight.from.y);
  useEffect(() => {
    x.value = withTiming(flight.to.x, { duration: FLIGHT_MS, easing: Easing.inOut(Easing.cubic) });
    y.value = withTiming(flight.to.y, { duration: FLIGHT_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) scheduleOnRN(onLand, flight.id);
    });
  }, [flight, onLand, x, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0 }, style]}>
      <View className="rounded-full shadow-md">
        <ChipFace name={flight.name} group={flight.group} />
      </View>
    </Animated.View>
  );
}

// ---- Add view ---------------------------------------------------------------
// Search and the tray of what's in the pantry stay pinned at the top, so a
// new chip is always visible above the keyboard; below them, results while
// typing, otherwise quick adds, recently removed and the staples shortcut.
function AddView({ onDone, onShowMeals, onViewStaples }: { onDone: () => void; onShowMeals: () => void; onViewStaples: () => void }) {
  const { data: pantry = [] } = usePantry();
  const actions = usePantryActions();
  const { data: catalog, isLoading } = useIngredientCatalog();
  const { staples, quickAdds } = usePantryStaples();
  const groupOf = usePantryGroups(pantry);
  const reduce = useReduceMotion();
  const [query, setQuery] = useState("");

  const recent = useRecentlyRemovedStore((s) => s.items);
  const loadRecent = useRecentlyRemovedStore((s) => s.load);
  useEffect(() => void loadRecent(), [loadRecent]);

  const addedIds = useMemo(() => new Set(pantry.map((item) => item.id)), [pantry]);
  const catalogById = useMemo(() => new Map((catalog ?? []).map((row) => [row.id, row])), [catalog]);
  const quickLeft = quickAdds.filter((row) => !addedIds.has(row.id));
  const recentLeft = recent.flatMap((item) => {
    const row = catalogById.get(item.id);
    return row && !addedIds.has(row.id) ? [row] : [];
  });
  // Newest first, so a new chip always lands in the tray's first slot.
  const tray = useMemo(() => [...pantry].reverse(), [pantry]);
  const [trayOpen, setTrayOpen] = useState(false);
  const trayShown = trayOpen ? tray : tray.slice(0, TRAY_PEEK);
  const trayFolded = tray.length - trayShown.length;
  // Nothing left to fold: back to the folded tray for next time.
  useEffect(() => {
    if (tray.length <= TRAY_PEEK) setTrayOpen(false);
  }, [tray.length]);

  const rootRef = useRef<ViewInstance>(null);
  const trayRef = useRef<ViewInstance>(null);
  const trayScrollRef = useRef<ScrollViewInstance>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const flying = useMemo(() => new Set(flights.map((f) => f.id)), [flights]);

  const land = useRef((id: string) => {
    setFlights((prev) => prev.filter((f) => f.id !== id));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }).current;

  const add = (row: IngredientRow, origin: PickOrigin) => {
    setQuery("");
    if (addedIds.has(row.id)) return;
    const item: PantryIngredient = { id: row.id, name: row.canonical_name };
    actions.add(item);
    trayScrollRef.current?.scrollTo({ y: 0, animated: !reduce });
    // Reduce motion: no flight, the chip just fades in.
    if (reduce || !origin || !rootRef.current || !trayRef.current) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    const flight = { id: row.id, name: pantryName(row.canonical_name), group: pantryGroupOf(row.category) };
    rootRef.current.measureInWindow((rx, ry) => {
      trayRef.current?.measureInWindow((tx, ty) => {
        setFlights((prev) => [
          ...prev.filter((f) => f.id !== row.id),
          {
            ...flight,
            from: { x: origin.x - rx - FACE_INSET.x, y: origin.y - ry - FACE_INSET.y },
            to: { x: tx - rx + TRAY_INSET, y: ty - ry },
          },
        ]);
      });
    });
  };

  // Footer: progress toward suggestions, then the reason to finish.
  const { matchedMeals, isLoading: matching } = usePantryMatches(pantry);
  const needed = PANTRY_MIN_FOR_SUGGESTIONS - pantry.length;
  const footer =
    needed > 0 ? (
      <Button
        variant="outline"
        onPress={onDone}
        accessibilityLabel={`Add ${needed} more to see meals. Closes the sheet.`}
        icon={<CountLabel before="Add" count={needed} after="more to see meals" tone="primary" />}
      />
    ) : !matching && matchedMeals > 0 ? (
      <Button
        onPress={onShowMeals}
        accessibilityLabel={`Show ${matchedMeals} meals`}
        icon={<CountLabel before="Show" count={matchedMeals} after={matchedMeals === 1 ? "meal" : "meals"} tone="onPrimary" />}
      />
    ) : (
      <Button label="Done" onPress={onDone} />
    );

  return (
    <View ref={rootRef} className="flex-1">
      <View className="gap-4 px-5 pt-10">
        <SheetHeader title="Add Ingredients" subtitle="What do you have?" />
        <SearchBar
          placeholder="Search ingredient…"
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery("")}
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {/* The tray: what's in the pantry, newest first. Folded to the newest
          few + "+N more" so a long pantry never pushes the search results
          off screen; unfolded, it wraps in a short box that scrolls down. */}
      <View className="gap-2 border-b border-ink-emphasis/5 pb-3 pt-4">
        <View className="flex-row items-center gap-1.5 px-5">
          <Text className="font-inter-bold text-sub uppercase tracking-widest text-ink-subtle">In your pantry</Text>
          {pantry.length > 0 && (
            <View className="rounded-full bg-primary/10 px-1.5 py-0.5">
              <RollingText value={pantry.length} rank={pantry.length} className="font-inter-semibold text-sub text-primary" />
            </View>
          )}
          <View className="flex-1" />
          {trayOpen && (
            <Pressable onPress={() => setTrayOpen(false)} hitSlop={8} accessibilityRole="button" className="active:opacity-60">
              <Text className="font-inter-semibold text-small text-primary">Show less</Text>
            </Pressable>
          )}
        </View>
        <View ref={trayRef}>
          <ScrollView
            ref={trayScrollRef}
            scrollEnabled={trayOpen}
            showsVerticalScrollIndicator={trayOpen}
            keyboardShouldPersistTaps="handled"
            className="max-h-44"
            contentContainerClassName="flex-row flex-wrap gap-2 px-5"
          >
            {tray.length === 0 ? (
              <View className="rounded-full border border-dashed border-ink-emphasis/20 px-3.5 py-2">
                <Text className="font-inter-regular text-body text-ink-placeholder">Nothing added yet</Text>
              </View>
            ) : (
              <>
                {trayShown.map((item) => (
                  <PantryChip
                    key={item.id}
                    item={item}
                    group={groupOf.get(item.id)}
                    hidden={flying.has(item.id)}
                    onRemove={() => actions.remove(item.id)}
                  />
                ))}
                {trayFolded > 0 && (
                  <Pressable
                    onPress={() => setTrayOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`Show all ${tray.length} ingredients`}
                    className="justify-center rounded-full border border-ink-emphasis/10 bg-white px-3.5 py-2 active:bg-ink-emphasis/5"
                  >
                    <Text className="font-inter-semibold text-body text-primary">+{trayFolded} more</Text>
                  </Pressable>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerClassName={query.trim() ? "px-5 pb-4 pt-1" : "gap-5 px-5 pb-4 pt-4"}
      >
        {query.trim() ? (
          <PantrySearchResults query={query} catalog={catalog} isLoading={isLoading} addedIds={addedIds} onPick={add} />
        ) : (
          <>
            <QuickAddChips title="Quick add" items={quickLeft} onPick={add} />
            <QuickAddChips title="Recently removed" items={recentLeft} onPick={add} />
            {staples.length > 0 && (
              <View className="flex-row items-center gap-3 rounded-2xl border border-primary/10 bg-primary/5 p-4">
                <Image source={INGREDIENT_CATEGORY_ICONS.condiments} style={{ width: 40, height: 40 }} />
                <View className="flex-1">
                  <Text className="font-inter-semibold text-body text-ink-emphasis">Add common condiments</Text>
                  <Text className="mt-0.5 font-inter-regular text-small text-ink-subtle">Quickly add the basics you usually have</Text>
                </View>
                <Pressable onPress={onViewStaples} className="rounded-full border border-primary px-3 py-1.5 active:bg-primary/5">
                  <Text className="font-inter-semibold text-small text-primary">View all</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View className="px-5 pb-4 pt-2">{footer}</View>

      {flights.map((f) => (
        <Flyer key={f.id} flight={f} onLand={land} />
      ))}
    </View>
  );
}
