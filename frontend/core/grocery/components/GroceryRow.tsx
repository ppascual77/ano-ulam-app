import { useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { Check } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import type { GroceryItem } from "../utils/buildGroceryList";

export const formatPeso = (n: number, decimals = 2) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const BOX_SPRING = { damping: 12, stiffness: 260, mass: 0.6 };

type GroceryRowProps = {
  item: GroceryItem;
  checked: boolean;
  onToggle: () => void;
  isLast: boolean;
  /** Full list: names wrap instead of truncating. */
  wrap?: boolean;
  /** Full list: the item is already in the user's pantry. */
  have?: boolean;
  /** Price pantry basics too (the full list's "Include pantry basics"). */
  pricePantry?: boolean;
};

// Rounded check box that fills green and pops when checked (only on a tap,
// not when the row first renders already checked).
function CheckBox({ checked }: { checked: boolean }) {
  const scale = useSharedValue(1);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (checked) scale.value = withSequence(withTiming(0.7, { duration: 70 }), withSpring(1, BOX_SPRING));
  }, [checked, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // Plain style on the Animated.View, className on the inner View: NativeWind
  // can knock out Reanimated's animated values.
  return (
    <Animated.View style={style}>
      <View
        className={`h-6 w-6 items-center justify-center rounded-lg border-2 border-primary ${checked ? "bg-primary" : "bg-white"}`}
      >
        {checked && <Check color={colors.white} size={15} strokeWidth={3.2} />}
      </View>
    </Animated.View>
  );
}

// Check box, then the name with its quantity right after it (and under that,
// a "N meals" tag when the item was merged from several meals), and the price
// on the right. Checked items fade and get struck through.
export function GroceryRow({ item, checked, onToggle, isLast, wrap = false, have = false, pricePantry = false }: GroceryRowProps) {
  const isMain = item.category === "main";
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className={`flex-row items-center gap-3 px-2 py-3 ${isLast ? "" : "border-b border-ink-emphasis/10"}`}
    >
      <CheckBox checked={checked} />

      <View className={`flex-1 gap-1 ${checked ? "opacity-40" : ""}`}>
        {/* Quantity right after the name, a size smaller and lighter (as in
            the meal detail's ingredient rows). */}
        <Text numberOfLines={wrap ? undefined : 1} className={checked ? "line-through" : ""}>
          <Text className="font-inter-semibold text-body text-ink-emphasis">{item.name}</Text>
          <Text className="font-inter-light text-small text-ink-subtle"> ({item.qty})</Text>
        </Text>
        {(item.meals > 1 || have) && (
          <View className="flex-row flex-wrap items-center gap-1.5">
            {item.meals > 1 && (
              <View className="rounded-full bg-category-breakfast px-2.5 py-0.5">
                <Text className="font-inter-extrabold text-small text-accent">{item.meals} meals</Text>
              </View>
            )}
            {have && (
              <View className="rounded-full bg-tinted-bg px-2.5 py-0.5">
                <Text className="font-inter-extrabold text-small text-primary">Have</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Pantry basics show a "Pantry" chip in the price's place, unless
          they're counted in the total and have a price. */}
      {(isMain || pricePantry) && item.price > 0 ? (
        <Text className={`font-inter-extrabold text-body text-ink-emphasis ${checked ? "opacity-40" : ""}`}>
          ₱{formatPeso(item.price, 0)}
        </Text>
      ) : (
        !isMain && (
          <View className={`rounded-full border border-ink-emphasis/15 px-2.5 py-0.5 ${checked ? "opacity-40" : ""}`}>
            <Text className="font-inter-extrabold text-small text-ink-subtle">Pantry</Text>
          </View>
        )
      )}
    </Pressable>
  );
}
