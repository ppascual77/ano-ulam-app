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
  /** Price pantry staples too (the full list's "Include in total"). */
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

// Check box, the name with one muted line under it (what to pick up, then
// "2 meals" / "in pantry"), and the price on the right. Checked items fade
// and get struck through.
export function GroceryRow({ item, checked, onToggle, isLast, wrap = false, have = false, pricePantry = false }: GroceryRowProps) {
  // Main ingredients, and pantry staples once "Include in total" is on.
  const counted = item.category === "main" || pricePantry;
  const detail = [item.buy, item.meals > 1 && `${item.meals} meals`, have && "in pantry"].filter(Boolean).join(" · ");
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className={`flex-row items-center gap-3 px-2 py-3 ${isLast ? "" : "border-b border-ink-emphasis/10"}`}
    >
      <CheckBox checked={checked} />

      <View className={`flex-1 gap-0.5 ${checked ? "opacity-40" : ""}`}>
        <Text
          numberOfLines={wrap ? undefined : 1}
          className={`font-inter-semibold text-body text-ink-emphasis ${checked ? "line-through" : ""}`}
        >
          {item.name}
        </Text>
        {!!detail && (
          <Text numberOfLines={wrap ? undefined : 1} className="font-inter-regular text-small text-ink-subtle">
            {detail}
          </Text>
        )}
      </View>

      {/* Pantry staples left out of the total say "Staple" in the price's
          place. ("Staple", not "Pantry": "in pantry" already means
          you have it.) */}
      {counted ? (
        item.price > 0 && (
          <Text className={`font-inter-extrabold text-body text-ink-emphasis ${checked ? "opacity-40" : ""}`}>
            {/* "~": no store listing behind it (an AI pack or the used amount). */}
            {item.estimate ? "~" : ""}₱{formatPeso(item.price, 0)}
          </Text>
        )
      ) : (
        <Text className={`font-inter-medium text-small text-ink-subtle ${checked ? "opacity-40" : ""}`}>Staple</Text>
      )}
    </Pressable>
  );
}
