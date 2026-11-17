import { useEffect, useRef } from "react";
import { View } from "react-native";
import Animated, { Easing, ZoomIn, ZoomOut, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ShoppingBasket } from "lucide-react-native";
import { PulsePressable } from "@/frontend/components/ui";
import { Text } from "@/frontend/components/ui/Text";
import { colors } from "@/frontend/constants/theme";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { useGroceryToBuyCount } from "@/frontend/core/grocery/hooks/useGroceryToBuyCount";
import { openGroceryList } from "@/frontend/core/grocery/store/useGrocerySheetStore";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

const SIZE = 44;
// The badge springs past full size and settles; the basket hops and tips
// a little, as if something just dropped in.
const POP = { damping: 7, stiffness: 340, mass: 0.5 };
const SETTLE = { damping: 12, stiffness: 260, mass: 0.6 };

// Home's shortcut to the grocery list (top right of the green header): a
// frosted circle with a basket, and an orange count of what's still to buy.
// Opens the list as a sheet right here. When a save adds ingredients, the
// badge pops and the basket hops. Signed in only: a guest has no saved
// meals, so no list.
export function GroceryButton() {
  const userId = useAuth().session?.user.id ?? null;
  if (!userId) return null;
  return <GroceryButtonInner />;
}

function GroceryButtonInner() {
  const count = useGroceryToBuyCount();
  const reduceMotion = useReduceMotion();
  const hop = useSharedValue(0);
  const tip = useSharedValue(0);
  const badge = useSharedValue(1);

  // Only a rise animates (a save added items), not the first load or
  // checking items off.
  const lastCount = useRef<number | null>(null);
  useEffect(() => {
    const previous = lastCount.current;
    lastCount.current = count;
    if (previous === null || count <= previous) return;
    badge.value = withSequence(withTiming(1.35, { duration: 110 }), withSpring(1, POP));
    if (reduceMotion) return;
    hop.value = withSequence(withTiming(-5, { duration: 140, easing: Easing.out(Easing.quad) }), withSpring(0, SETTLE));
    tip.value = withSequence(
      withTiming(-12, { duration: 110 }),
      withTiming(9, { duration: 130 }),
      withSpring(0, SETTLE),
    );
  }, [count]);

  const basketStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hop.value }, { rotate: `${tip.value}deg` }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badge.value }] }));

  const label = count > 0 ? `Grocery list, ${count} item${count === 1 ? "" : "s"} to buy` : "Grocery list";

  return (
    <PulsePressable
      onPress={() => {
        Haptics.selectionAsync();
        openGroceryList();
      }}
      ringColor={colors.white}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: SIZE, height: SIZE }}
    >
      <View className="flex-1 items-center justify-center rounded-full border border-white/20 bg-white/10">
        {/* Plain style on the Animated.Views, className on the inner
            Views: NativeWind can knock out Reanimated's animated values. */}
        <Animated.View style={basketStyle}>
          <ShoppingBasket color={colors.white} size={20} strokeWidth={2} />
        </Animated.View>
      </View>
      {count > 0 && (
        <Animated.View
          entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)}
          exiting={reduceMotion ? undefined : ZoomOut.duration(160)}
          pointerEvents="none"
          style={[{ position: "absolute", top: -3, right: -3 }, badgeStyle]}
        >
          <View className="h-5 min-w-5 items-center justify-center rounded-full border-2 border-home-top bg-accent px-1">
            <Text className="font-inter-bold text-sub text-white">
              {count > 99 ? "99+" : count}
            </Text>
          </View>
        </Animated.View>
      )}
    </PulsePressable>
  );
}
