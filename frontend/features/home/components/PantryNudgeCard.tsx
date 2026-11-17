import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { Easing, FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Check, ShoppingBasket } from "lucide-react-native";
import { Text } from "@/frontend/components/ui/Text";
import { Button, showGlobalToast } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { CheckBox } from "@/frontend/core/grocery/components/GroceryRow";
import { UsedUpSheet } from "@/frontend/core/pantry/components/UsedUpSheet";
import { usePantry } from "@/frontend/core/pantry/hooks/usePantry";
import { useMorningNudge } from "@/frontend/core/pantry/hooks/useMorningNudge";
import { useLaterPlanNeeds } from "@/frontend/core/pantry/hooks/usePlanPantryNeeds";
import { buildUsedUpGroups, type UsedUpGroup } from "@/frontend/core/pantry/usedUp";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { SLOT_LABELS } from "@/frontend/features/meal-planner/utils/generatePlan";

const EASE = Easing.out(Easing.cubic);

// Home's morning check-in: yesterday's planned meals, ticked (most people
// cook what they planned), and one tap into "Anything used up?". Answering
// or skipping puts it away for the day.
export function PantryNudgeCard() {
  const nudge = useMorningNudge();
  const reduceMotion = useReduceMotion();
  const { data: pantry = [] } = usePantry();
  const { needs } = useLaterPlanNeeds(undefined, nudge.visible);
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [groups, setGroups] = useState<UsedUpGroup[]>([]);
  // Hidden as soon as it's answered (the sheet may still be closing).
  const [answered, setAnswered] = useState(false);
  const sheetShown = useRef(false);

  // A new day's meals start all ticked.
  const mealKey = nudge.meals.map((m) => m.id).join(",");
  useEffect(() => setUnticked(new Set()), [mealKey]);

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    setUnticked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const skip = () => {
    Haptics.selectionAsync();
    setAnswered(true);
    nudge.answer(true);
  };

  const update = () => {
    const cooked = nudge.meals.filter((m) => !unticked.has(m.id));
    const next = buildUsedUpGroups(cooked, pantry, needs);
    if (next.length === 0) {
      setAnswered(true);
      nudge.answer(false);
      showGlobalToast({ tone: "success", message: "Your pantry's already up to date" });
      return;
    }
    setGroups(next);
    sheetShown.current = true;
    setSheetOpen(true);
  };

  const ticked = nudge.meals.length - unticked.size;
  const showCard = nudge.visible && !answered;

  return (
    <>
      {showCard && (
        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.duration(320).delay(250).easing(EASE)}
          exiting={reduceMotion ? undefined : FadeOut.duration(200)}
          layout={reduceMotion ? undefined : LinearTransition.duration(260).easing(EASE)}
        >
          {/* Classes on the inner View: NativeWind can knock out
              Reanimated's animated values. */}
          <View className="mt-4 rounded-3xl border border-ink-emphasis/10 bg-white p-4 shadow-sm">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-2xl bg-tinted-bg">
              <ShoppingBasket color={colors.primary} size={20} />
            </View>
            <View className="flex-1">
              <Text className="font-inter-extrabold text-subheading text-ink-emphasis">Cooked any of these?</Text>
              <Text className="font-inter-regular text-small text-ink-subtle">Let us know and we&apos;ll tidy up your pantry.</Text>
            </View>
          </View>

          <View className="mt-2">
            {nudge.meals.map((meal) => {
              const on = !unticked.has(meal.id);
              return (
                <Pressable
                  key={meal.id}
                  onPress={() => toggle(meal.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${meal.name}, ${SLOT_LABELS[meal.slot]} yesterday`}
                  className="min-h-11 flex-row items-center gap-3 rounded-xl px-1 py-2 active:bg-primary/5"
                >
                  <CheckBox checked={on} />
                  <View className="flex-1">
                    <Text numberOfLines={1} className="font-inter-semibold text-body-lg text-ink-emphasis">
                      {meal.name}
                    </Text>
                    <Text className="font-inter-regular text-small text-ink-subtle">{SLOT_LABELS[meal.slot]} · yesterday</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {nudge.done.length > 0 && (
            <View className="mt-1 flex-row items-center gap-1.5 px-1">
              <Check color={colors.ink.subtle} size={13} strokeWidth={2.5} />
              <Text numberOfLines={1} className="flex-1 font-inter-regular text-small text-ink-subtle">
                {nudge.done.join(", ")} already updated
              </Text>
            </View>
          )}

          <View className="mt-4 flex-row gap-3">
            <View className="flex-1">
              <Button variant="muted" label="Skip" onPress={skip} />
            </View>
            <View style={{ flex: 2 }}>
              <Button label="Update pantry" onPress={update} disabled={ticked === 0} />
            </View>
          </View>
          </View>
        </Animated.View>
      )}

      <UsedUpSheet
        visible={sheetOpen}
        groups={groups}
        onClose={() => {
          setSheetOpen(false);
          setAnswered(true);
        }}
        onClosed={() => {
          // Reported once on mount too: only a real close counts.
          if (sheetShown.current) nudge.answer(false);
        }}
      />
    </>
  );
}
