import { memo, startTransition, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { AppText } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { PriceCategory } from "@/frontend/core/prices/utils/prices";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { CategoryTile } from "./CategoryTile";
import { priceWatchCategories } from "../constants/categories";

// Same language as Home's category picker: calm neutral tiles, and one
// green highlight behind the selected tile that glides to it (across and
// down: this grid is two rows), grows in from nothing, shrinks away on
// "See all". The chosen photo hops, the rest dim, a selection haptic.
// No overshoot (the grid runs edge to edge in a clipping scroll view).
// Reduce motion: the highlight jumps; no hop.
//
// Instant on tap: picking a category refilters and re-renders the whole
// price list, so nothing waits for that. The highlight starts moving from
// the press handler itself (on the UI thread), the grid shows the pick from
// its own state right away (hop, dimming), and the list's update is a
// low-priority transition behind it.

const COLUMNS = 4;
const GAP = 10;
const RADIUS = 16;
const GLIDE = { duration: 240, easing: Easing.out(Easing.cubic) };

type CategoryGridProps = {
  /** null = All. */
  selected: PriceCategory | null;
  onSelect: (category: PriceCategory | null) => void;
};

// Tapping the selected tile again (or "See all") goes back to All.
function CategoryGridInner({ selected, onSelect }: CategoryGridProps) {
  const reduce = useReduceMotion();
  // The pick as shown here, ahead of the screen's (slower) update.
  const [current, setCurrent] = useState(selected);
  useEffect(() => setCurrent(selected), [selected]);
  const [tileW, setTileW] = useState(0);
  const [tileH, setTileH] = useState(0);

  // The highlight's cell (fractional while gliding) and how shown it is.
  const col = useSharedValue(0);
  const row = useSharedValue(0);
  const shown = useSharedValue(0);
  const moveTo = (id: PriceCategory | null) => {
    const i = id ? priceWatchCategories.findIndex((c) => c.id === id) : -1;
    if (i < 0) {
      shown.value = reduce ? 0 : withTiming(0, { duration: 180 });
      return;
    }
    const c = i % COLUMNS;
    const r = Math.floor(i / COLUMNS);
    if (shown.value < 0.05 || reduce) {
      col.value = c;
      row.value = r;
      shown.value = reduce ? 1 : withTiming(1, GLIDE);
    } else {
      col.value = withTiming(c, GLIDE);
      row.value = withTiming(r, GLIDE);
    }
  };
  // A change from outside (search clearing it, the initial pick).
  useEffect(() => moveTo(selected), [selected]);

  const highlight = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateX: col.value * (tileW + GAP) }, { translateY: row.value * (tileH + GAP) }, { scale: 0.88 + 0.12 * shown.value }],
  }));

  const pick = (next: PriceCategory | null) => {
    moveTo(next);
    setCurrent(next);
    startTransition(() => onSelect(next));
  };
  const choose = (id: PriceCategory) => {
    void Haptics.selectionAsync();
    pick(id === current ? null : id);
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <AppText variant="title">Check by Category</AppText>
        {current && (
          <Pressable onPress={() => pick(null)} hitSlop={8}>
            <AppText variant="bodyMedium" className="text-primary">
              See all
            </AppText>
          </Pressable>
        )}
      </View>

      <View
        className="flex-row flex-wrap"
        style={{ gap: GAP }}
        onLayout={(e) => setTileW((e.nativeEvent.layout.width - GAP * (COLUMNS - 1)) / COLUMNS)}
      >
        {tileW > 0 && tileH > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              { position: "absolute", top: 0, left: 0, width: tileW, height: tileH, borderRadius: RADIUS, borderWidth: 1.5, borderColor: `${colors.primary}55`, backgroundColor: colors.tintedBg },
              highlight,
            ]}
          />
        )}
        {tileW > 0 &&
          priceWatchCategories.map((category, i) => (
            <CategoryTile
              key={category.id}
              index={i}
              width={tileW}
              category={category}
              selected={category.id === current}
              dimmed={current != null && category.id !== current}
              reduce={reduce}
              onPress={() => choose(category.id)}
              onMeasure={i === 0 ? setTileH : undefined}
            />
          ))}
      </View>
    </View>
  );
}

// Re-renders only when its own props change, not whenever the screen does
// (a Price Watch re-render, e.g. on a tab switch, cost ~150-200ms when
// every section re-rendered with it).
export const CategoryGrid = memo(CategoryGridInner);
