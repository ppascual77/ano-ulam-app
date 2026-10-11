import { useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { Check, Plus, Undo2 } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import type { GroceryItem } from "../utils/buildGroceryList";

export const formatPeso = (n: number, decimals = 2) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const BOX_SPRING = { damping: 12, stiffness: 260, mass: 0.6 };
// Fixed columns, so amounts and prices line up down the list instead of
// starting wherever each name ends.
const AMOUNT_WIDTH = 88;
const PRICE_WIDTH = 64;
const TABULAR = { fontVariant: ["tabular-nums" as const] };

type GroceryRowProps = {
  item: GroceryItem;
  checked: boolean;
  onToggle: () => void;
  /** Full list: names wrap instead of truncating. */
  wrap?: boolean;
  /** Full list: the item is already in the user's pantry. */
  have?: boolean;
  /** A read-only preview (Profile's Grocery tab): faint check boxes and no
   *  tapping a row, since the whole preview opens the full list. */
  preview?: boolean;
  /** Full list: moves a pantry staple to "To buy" (a "+ To buy" button),
   *  or a moved one back (an undo icon under its price). */
  onMove?: () => void;
};

// Rounded check box that fills green and pops when checked (only on a tap,
// not when the row first renders already checked).
function CheckBox({ checked, faint = false }: { checked: boolean; faint?: boolean }) {
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
        // A light outline until checked, so the boxes don't outweigh the
        // names; filled solid once checked.
        className={`h-6 w-6 items-center justify-center rounded-lg border-2 ${
          checked ? (faint ? "border-primary/30 bg-primary/30" : "border-primary bg-primary") : faint ? "border-primary/20 bg-white" : "border-primary/40 bg-white"
        }`}
      >
        {checked && <Check color={colors.white} size={15} strokeWidth={3.2} />}
      </View>
    </Animated.View>
  );
}

// Check box, the name (with "2 meals" / "In pantry" chips), then two fixed
// columns: what to pick up and the price. No dividers: the list's section
// headers and spacing group the rows. Checked items fade and get struck
// through.
export function GroceryRow({ item, checked, onToggle, wrap = false, have = false, preview = false, onMove }: GroceryRowProps) {
  // Main ingredients and staples moved to "To buy" are priced and counted.
  const counted = item.category === "main";
  // Only items on the shopping run show as checked off (a staple checked
  // before staples lost their box shouldn't stay faded).
  const done = counted && checked;
  // A staple isn't on the shopping run, so there's nothing to check off: its
  // one action is "+ To buy". No box and no blank in its place (a gap there
  // looked like something was missing).
  return (
    <Pressable
      onPress={counted && !preview ? onToggle : undefined}
      disabled={!counted || preview}
      // A preview row lets the tap through to the preview around it.
      pointerEvents={preview ? "none" : "auto"}
      accessibilityRole={counted ? "checkbox" : undefined}
      accessibilityState={counted ? { checked } : undefined}
      className="flex-row items-center gap-3 px-2 py-2.5"
    >
      {counted && <CheckBox checked={checked} faint={preview} />}

      <View className={`flex-1 flex-row flex-wrap items-center gap-1.5 ${done ? "opacity-40" : ""}`}>
        <Text
          numberOfLines={wrap ? undefined : 1}
          className={`flex-shrink font-inter-semibold text-body text-ink-emphasis ${done ? "line-through" : ""}`}
        >
          {item.name}
        </Text>
        {item.meals > 1 && (
          <View className="rounded-full bg-category-breakfast px-2.5 py-0.5">
            <Text className="font-inter-extrabold text-small text-accent">{item.meals} meals</Text>
          </View>
        )}
        {have && (
          <View className="rounded-full bg-tinted-bg px-2.5 py-0.5">
            <Text className="font-inter-extrabold text-small text-primary">In pantry</Text>
          </View>
        )}
      </View>

      <Text
        numberOfLines={2}
        style={[{ width: AMOUNT_WIDTH }, TABULAR]}
        className={`text-right font-inter-regular text-small text-ink-subtle ${done ? "opacity-40" : ""}`}
      >
        {item.buy}
      </Text>

      {/* Pantry staples aren't counted: a "+ To buy" button in the price's
          place for when you're out of one, unless the pantry says you have
          it ("Staple" where it can't be moved). ("Staple", not "Pantry":
          "In pantry" already means you have it.) */}
      <View style={{ width: PRICE_WIDTH }} className={`items-end gap-1 ${done ? "opacity-40" : ""}`}>
        {counted ? (
          <>
            {item.price > 0 && (
              <Text style={TABULAR} className="font-inter-extrabold text-body text-ink-emphasis">
                {/* "~": no store listing behind it (an AI pack or the used amount). */}
                {item.estimate ? "~" : ""}₱{formatPeso(item.price, 0)}
              </Text>
            )}
            {item.movedFromStaples && onMove && (
              <Pressable onPress={onMove} hitSlop={10} accessibilityLabel={`Move ${item.name} back to pantry staples`}>
                <Undo2 color={colors.ink.subtle} size={16} strokeWidth={2.25} />
              </Pressable>
            )}
          </>
        ) : have ? null : onMove ? (
          <Pressable onPress={onMove} hitSlop={8} accessibilityLabel={`Move ${item.name} to To buy`} className="flex-row items-center gap-1">
            <Plus color={colors.primary} size={14} strokeWidth={2.5} />
            <Text className="font-inter-semibold text-small text-primary">To buy</Text>
          </Pressable>
        ) : (
          <Text className="font-inter-medium text-small text-ink-subtle">Staple</Text>
        )}
      </View>
    </Pressable>
  );
}
