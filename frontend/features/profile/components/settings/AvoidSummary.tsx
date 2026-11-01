import { useMemo } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import type { AvoidedIngredient } from "@/api/auth";
import { useAvoidImpact } from "@/frontend/core/preferences/hooks/useAvoidImpact";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { avoidLabel } from "./AvoidIngredientsSheet";

const SHOWN = 3;

// Settings > Pro > Ingredients to avoid, once something is set: the first
// few as small chips (+N for the rest) and how many meals they hide. Chips
// fade in and out and the row reflows as the list changes.
export function AvoidSummary({ avoided }: { avoided: AvoidedIngredient[] }) {
  const reduceMotion = useReduceMotion();
  const ids = useMemo(() => avoided.map((a) => a.id), [avoided]);
  const { hidden, loading } = useAvoidImpact(ids);
  const layout = reduceMotion ? undefined : LinearTransition.duration(220).easing(Easing.out(Easing.cubic));
  const extra = avoided.length - SHOWN;

  return (
    <View className="mt-1.5 gap-1.5">
      <View className="flex-row flex-wrap gap-1.5">
        {avoided.slice(0, SHOWN).map((item) => (
          <Animated.View key={item.id} entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} layout={layout}>
            <View className="rounded-full bg-ink-emphasis/5 px-2.5 py-1">
              <Text className="font-inter-medium text-small text-ink-emphasis" numberOfLines={1}>
                {avoidLabel(item)}
              </Text>
            </View>
          </Animated.View>
        ))}
        {extra > 0 && (
          <Animated.View key="more" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} layout={layout}>
            <View className="rounded-full bg-ink-emphasis/5 px-2.5 py-1">
              <Text className="font-inter-medium text-small text-ink-subtle">+{extra}</Text>
            </View>
          </Animated.View>
        )}
      </View>
      {!loading && (
        <Text className="font-inter-regular text-small text-ink-subtle">
          Hiding {hidden} {hidden === 1 ? "meal" : "meals"}
        </Text>
      )}
    </View>
  );
}
