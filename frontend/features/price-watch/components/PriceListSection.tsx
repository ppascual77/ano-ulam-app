import { useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { TrendingDown } from "lucide-react-native";
import { AppText, SearchBar } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { PriceItem } from "@/frontend/core/prices/utils/prices";
import { PriceRow } from "./PriceRow";

const SKELETON_ROWS = 8;
// When the list switches (a new category, or searching): the title pops and
// the rows fade and lift back in, so it's clear the results changed.
const PULSE_MS = 420;
const TITLE_POP = 0.08;
const ROWS_DIM = 0.35;
const ROWS_LIFT = 10;

type PriceListSectionProps = {
  title: string;
  items: PriceItem[];
  loading: boolean;
  search: string;
  onSearch: (q: string) => void;
  sortByDrop: boolean;
  onToggleSort: () => void;
  onSelect: (item: PriceItem) => void;
};

export function PriceListSection({
  title,
  items,
  loading,
  search,
  onSearch,
  sortByDrop,
  onToggleSort,
  onSelect,
}: PriceListSectionProps) {
  // 0 -> 1 over a pulse; 1 at rest. Not on first render.
  const pulse = useSharedValue(1);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    pulse.value = 0;
    pulse.value = withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.cubic) });
  }, [title, pulse]);

  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + TITLE_POP * Math.sin(Math.PI * pulse.value) }],
  }));
  const rowsStyle = useAnimatedStyle(() => ({
    opacity: ROWS_DIM + (1 - ROWS_DIM) * pulse.value,
    transform: [{ translateY: ROWS_LIFT * (1 - pulse.value) }],
  }));

  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between">
        <Animated.View style={[{ transformOrigin: "left" }, titleStyle]}>
          <AppText variant="title">{title}</AppText>
        </Animated.View>
        <Pressable
          onPress={onToggleSort}
          accessibilityRole="switch"
          accessibilityState={{ checked: sortByDrop }}
          accessibilityLabel="Sort by biggest price drop"
          className={`flex-row items-center gap-1 rounded-full border px-3 py-1 ${
            sortByDrop ? "border-primary/30 bg-primary/10" : "border-ink-emphasis/10 bg-ink-emphasis/5"
          }`}
        >
          <TrendingDown color={sortByDrop ? colors.primary : colors.ink.placeholder} size={12} />
          <Text className={`font-inter-medium text-small ${sortByDrop ? "text-primary" : "text-ink-subtle"}`}>
            Biggest drop
          </Text>
        </Pressable>
      </View>

      <View className="mb-3">
        <SearchBar
          placeholder="Search ingredients..."
          value={search}
          onChangeText={onSearch}
          onClear={() => onSearch("")}
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {loading ? (
        Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <View key={i} className="mb-2 h-14 rounded-2xl bg-ink-emphasis/5" />
        ))
      ) : items.length === 0 ? (
        <AppText variant="caption" className="py-8 text-center">
          No ingredients found.
        </AppText>
      ) : (
        <Animated.View style={rowsStyle}>
          {items.map((item) => (
            <PriceRow key={item.id} item={item} onPress={() => onSelect(item)} />
          ))}
        </Animated.View>
      )}
    </View>
  );
}
