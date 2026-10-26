import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
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
// No spring overshoot (the grid runs edge to edge in a clipping scroll view).
// Reduce motion: the highlight jumps; no hop.

const COLUMNS = 4;
const GAP = 10;
const RADIUS = 16;
const SLIDE = { damping: 30, stiffness: 260, mass: 0.8, overshootClamping: true };

type CategoryGridProps = {
  /** null = All. */
  selected: PriceCategory | null;
  onSelect: (category: PriceCategory | null) => void;
};

// Tapping the selected tile again (or "See all") goes back to All.
export function CategoryGrid({ selected, onSelect }: CategoryGridProps) {
  const reduce = useReduceMotion();
  const [tileW, setTileW] = useState(0);
  const [tileH, setTileH] = useState(0);

  // The highlight's cell (fractional while gliding) and how shown it is.
  const col = useSharedValue(0);
  const row = useSharedValue(0);
  const shown = useSharedValue(0);
  useEffect(() => {
    const i = selected ? priceWatchCategories.findIndex((c) => c.id === selected) : -1;
    if (i < 0) {
      shown.value = reduce ? 0 : withTiming(0, { duration: 180 });
      return;
    }
    const c = i % COLUMNS;
    const r = Math.floor(i / COLUMNS);
    if (shown.value < 0.05 || reduce) {
      col.value = c;
      row.value = r;
      shown.value = reduce ? 1 : withSpring(1, SLIDE);
    } else {
      col.value = withSpring(c, SLIDE);
      row.value = withSpring(r, SLIDE);
    }
  }, [selected, reduce, col, row, shown]);

  const highlight = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateX: col.value * (tileW + GAP) }, { translateY: row.value * (tileH + GAP) }, { scale: 0.88 + 0.12 * shown.value }],
  }));

  const choose = (id: PriceCategory) => {
    void Haptics.selectionAsync();
    onSelect(id === selected ? null : id);
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <AppText variant="title">Check by Category</AppText>
        {selected && (
          <Pressable onPress={() => onSelect(null)} hitSlop={8}>
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
              selected={category.id === selected}
              dimmed={selected != null && category.id !== selected}
              reduce={reduce}
              onPress={() => choose(category.id)}
              onMeasure={i === 0 ? setTileH : undefined}
            />
          ))}
      </View>
    </View>
  );
}
