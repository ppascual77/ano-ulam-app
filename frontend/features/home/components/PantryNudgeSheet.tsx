import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, SlideInLeft, SlideInRight } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Check, ShoppingBasket } from "lucide-react-native";
import { Text } from "@/frontend/components/ui/Text";
import { AppText, BottomSheet, Button, isModalSheetOpen, showGlobalToast } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { CheckBox } from "@/frontend/core/grocery/components/GroceryRow";
import { UsedUpBody } from "@/frontend/core/pantry/components/UsedUpSheet";
import { usePantry } from "@/frontend/core/pantry/hooks/usePantry";
import { useMorningNudge } from "@/frontend/core/pantry/hooks/useMorningNudge";
import { useLaterPlanNeeds } from "@/frontend/core/pantry/hooks/usePlanPantryNeeds";
import { buildUsedUpGroups, type UsedUpGroup } from "@/frontend/core/pantry/usedUp";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { SLOT_LABELS } from "@/frontend/features/meal-planner/utils/generatePlan";

const EASE = Easing.out(Easing.cubic);
// Home settles first (its own entrance, the plan card) before the sheet
// rises, so it reads as a check-in rather than something in the way.
const OPEN_DELAY_MS = 1200;
// The steps slide sideways into each other, like pages.
const STEP_MS = 280;

type NudgeSheetProps = {
  /** Off while something else owns the screen (Home's welcome intro). */
  enabled: boolean;
};

// Home's morning check-in, as a sheet: yesterday's planned meals, ticked
// (most people cook what they planned), then "Anything used up?" in the
// same sheet. Answering, skipping or swiping it down puts it away for the
// day (see useMorningNudge for when it's due).
export function PantryNudgeSheet({ enabled }: NudgeSheetProps) {
  const nudge = useMorningNudge();
  const [open, setOpen] = useState(false);
  // Mounted from the first open until its close animation ends, so the
  // sheet's mount-time "closed" never counts as an answer.
  const [mounted, setMounted] = useState(false);
  const askedRef = useRef(false);
  // Only while Home is the screen in front (not from a tab left behind).
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    if (!enabled || !focused || !nudge.visible || askedRef.current) return;
    const timer = setTimeout(() => {
      // Never over another sheet (a grocery list opened in the meantime).
      if (isModalSheetOpen()) return;
      askedRef.current = true;
      setMounted(true);
      setOpen(true);
    }, OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [enabled, focused, nudge.visible]);

  if (!mounted) return null;
  return <NudgeSheet nudge={nudge} visible={open} onClose={() => setOpen(false)} onClosed={() => setMounted(false)} />;
}

type Nudge = ReturnType<typeof useMorningNudge>;

export function NudgeSheet({ nudge, visible, onClose, onClosed }: { nudge: Nudge; visible: boolean; onClose: () => void; onClosed: () => void }) {
  const reduceMotion = useReduceMotion();
  const { data: pantry = [] } = usePantry();
  const { needs } = useLaterPlanNeeds(undefined, true);
  // The meals as they were when it opened (the list doesn't shift under
  // the user as the pantry changes).
  const [meals] = useState(nudge.meals);
  const [done] = useState(nudge.done);
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<"meals" | "usedUp">("meals");
  const [groups, setGroups] = useState<UsedUpGroup[]>([]);
  // How it was answered, reported once it's closed: Skip and a swipe down
  // count toward "weekly after three skips"; anything else doesn't.
  const skipped = useRef(true);

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    setUnticked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const close = (wasSkipped: boolean) => {
    skipped.current = wasSkipped;
    onClose();
  };

  const next = () => {
    Haptics.selectionAsync();
    const cooked = meals.filter((m) => !unticked.has(m.id));
    const nextGroups = buildUsedUpGroups(cooked, pantry, needs);
    if (nextGroups.length === 0) {
      showGlobalToast({ tone: "success", message: "Your pantry's already up to date" });
      close(false);
      return;
    }
    setGroups(nextGroups);
    setStep("usedUp");
  };

  const ticked = meals.length - unticked.size;
  const forward = reduceMotion ? undefined : SlideInRight.duration(STEP_MS).easing(EASE);
  const back = reduceMotion ? undefined : SlideInLeft.duration(STEP_MS).easing(EASE);

  return (
    <BottomSheet
      visible={visible}
      onClose={() => close(true)}
      onClosed={() => {
        nudge.answer(skipped.current);
        onClosed();
      }}
      fitContent
      heightPercent={0.85}
    >
      <View className="overflow-hidden px-6 pb-6 pt-10">
        {step === "meals" ? (
          <Animated.View key="meals" entering={groups.length > 0 ? back : undefined}>
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-tinted-bg">
                <ShoppingBasket color={colors.primary} size={22} />
              </View>
              <View className="flex-1">
                <AppText variant="sectionSubtitle" dot>
                  Cooked any of these?
                </AppText>
              </View>
            </View>
            <Text className="mt-2 font-inter-regular text-body text-ink-subtle">Let us know and we&apos;ll tidy up your pantry.</Text>

            <View className="mt-3">
              {meals.map((meal, i) => {
                const on = !unticked.has(meal.id);
                return (
                  <Animated.View key={meal.id} entering={reduceMotion ? undefined : FadeInDown.duration(240).delay(120 + i * 50)}>
                    <Pressable
                      onPress={() => toggle(meal.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`${meal.name}, ${SLOT_LABELS[meal.slot]} yesterday`}
                      className="min-h-11 flex-row items-center gap-3 rounded-xl px-2 py-2.5 active:bg-primary/5"
                    >
                      <CheckBox checked={on} />
                      <View className="flex-1">
                        <Text numberOfLines={1} className="font-inter-semibold text-body-lg text-ink-emphasis">
                          {meal.name}
                        </Text>
                        <Text className="font-inter-regular text-small text-ink-subtle">{SLOT_LABELS[meal.slot]} · yesterday</Text>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            {done.length > 0 && (
              <View className="mt-1 flex-row items-center gap-1.5 px-2">
                <Check color={colors.ink.subtle} size={13} strokeWidth={2.5} />
                <Text numberOfLines={1} className="flex-1 font-inter-regular text-small text-ink-subtle">
                  {done.join(", ")} already updated
                </Text>
              </View>
            )}

            <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(200).delay(220)}>
              <View className="mt-6 flex-row gap-3">
                <View className="flex-1">
                  <Button variant="muted" label="Skip" onPress={() => close(true)} />
                </View>
                <View style={{ flex: 2 }}>
                  <Button label="Update pantry" onPress={next} disabled={ticked === 0} />
                </View>
              </View>
            </Animated.View>
          </Animated.View>
        ) : (
          <Animated.View key="usedUp" entering={forward}>
            <UsedUpBody
              groups={groups}
              skipLabel="Back"
              onDone={(updated) => {
                if (updated) close(false);
                else {
                  Haptics.selectionAsync();
                  setStep("meals");
                }
              }}
            />
          </Animated.View>
        )}
      </View>
    </BottomSheet>
  );
}
