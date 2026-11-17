import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, SlideInLeft, SlideInRight } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ShoppingBasket } from "lucide-react-native";
import { Text } from "@/frontend/components/ui/Text";
import { AppText, BottomSheet, Button, isModalSheetOpen, showGlobalToast } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { CheckBox } from "@/frontend/core/grocery/components/GroceryRow";
import { useSavedMealsForGrocery } from "@/frontend/core/grocery/hooks/useSavedMealsForGrocery";
import { UsedUpBody } from "@/frontend/core/pantry/components/UsedUpBody";
import { usePantry, usePantryActions } from "@/frontend/core/pantry/hooks/usePantry";
import { type NudgeMeal, useMorningNudge } from "@/frontend/core/pantry/hooks/useMorningNudge";
import { useLaterPlanNeeds } from "@/frontend/core/pantry/hooks/usePlanPantryNeeds";
import type { PantryIngredient } from "@/frontend/core/pantry/types";
import { addAlsoIn, buildUsedUpGroups, type UsedUpGroup } from "@/frontend/core/pantry/usedUp";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { useSavedMealActions } from "@/frontend/core/saved/hooks/useSavedMeals";

const EASE = Easing.out(Easing.cubic);
// Home settles first (its own entrance, the plan card) before the sheet
// rises, so it reads as a check-in rather than something in the way.
const OPEN_DELAY_MS = 1200;
// The steps slide sideways into each other, like pages.
const STEP_MS = 280;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

type NudgeSheetProps = {
  /** Off while something else owns the screen (Home's welcome intro). */
  enabled: boolean;
};

// Home's check-in, as a sheet: "Cooked any of your saved meals?" (the ones
// saved a few days ago start ticked), then "Anything used up?" in the same
// sheet. Updating takes the cooked meals off the list (unsaves them) and
// the used-up items out of the pantry, with one Undo. Answering, skipping
// or swiping it down puts it away for the day (see useMorningNudge for
// when it's due).
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
    let timer: ReturnType<typeof setTimeout>;
    const attempt = () => {
      timer = setTimeout(() => {
        // Never over another sheet (the grocery list, whose ticks may be
        // what made it due): try again once that sheet has closed.
        if (isModalSheetOpen()) return attempt();
        askedRef.current = true;
        setMounted(true);
        setOpen(true);
      }, OPEN_DELAY_MS);
    };
    attempt();
    return () => clearTimeout(timer);
  }, [enabled, focused, nudge.visible]);

  if (!mounted) return null;
  return <NudgeSheet nudge={nudge} visible={open} onClose={() => setOpen(false)} onClosed={() => setMounted(false)} />;
}

type Nudge = ReturnType<typeof useMorningNudge>;

export function NudgeSheet({ nudge, visible, onClose, onClosed }: { nudge: Nudge; visible: boolean; onClose: () => void; onClosed: () => void }) {
  const reduceMotion = useReduceMotion();
  const { data: pantry = [] } = usePantry();
  const pantryActions = usePantryActions();
  const savedActions = useSavedMealActions();
  const { meals: allSaved } = useSavedMealsForGrocery();
  const { needs } = useLaterPlanNeeds(true);
  // The meals as they were when it opened (the list doesn't shift under
  // the user as the pantry changes).
  const [meals] = useState<NudgeMeal[]>(nudge.meals);
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(nudge.meals.filter((m) => m.likely).map((m) => m.key)));
  const [step, setStep] = useState<"meals" | "usedUp">("meals");
  const [groups, setGroups] = useState<UsedUpGroup[]>([]);
  // How it was answered, reported once it's closed: Skip and a swipe down
  // count toward backing off; anything else doesn't.
  const skipped = useRef(true);

  const toggle = (key: string) => {
    Haptics.selectionAsync();
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const close = (wasSkipped: boolean) => {
    skipped.current = wasSkipped;
    onClose();
  };

  const cooked = meals.filter((m) => ticked.has(m.key));

  // The cooked meals come off the list, the used-up items out of the
  // pantry; one toast says both, and its Undo puts both back.
  const finish = (usedUp: PantryIngredient[]) => {
    pantryActions.removeMany(usedUp.map((item) => item.id));
    for (const meal of cooked) void savedActions.unsave(meal.saved, true);
    const done = cooked.length === 1 ? `${cooked[0].name} done` : `${plural(cooked.length, "meal")} done`;
    showGlobalToast({
      tone: "success",
      message: usedUp.length > 0 ? `${done} · ${plural(usedUp.length, "item")} taken out of your pantry` : `${done} · off your list`,
      action: {
        label: "Undo",
        inSheet: true,
        onPress: () => {
          pantryActions.addMany(usedUp);
          for (const meal of cooked) void savedActions.save(meal.saved, meal.saved.serving_size, true);
        },
      },
    });
    close(false);
  };

  const next = () => {
    Haptics.selectionAsync();
    // Another saved meal (not cooked) or a planned one still needs it:
    // starts unticked, with a note saying which.
    const others = allSaved.filter((meal) => !ticked.has(meal.saved_id)).map((meal) => ({ key: meal.saved_id, name: meal.name, ingredients: meal.ingredients ?? [] }));
    const nextGroups = buildUsedUpGroups(cooked, pantry, addAlsoIn(new Map(needs), others));
    if (nextGroups.length === 0) {
      finish([]);
      return;
    }
    setGroups(nextGroups);
    setStep("usedUp");
  };

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
                  Cooked any of your saved meals?
                </AppText>
              </View>
            </View>
            <Text className="mt-2 font-inter-regular text-body text-ink-subtle">
              We&apos;ll take them off your grocery list and tidy up your pantry.
            </Text>

            <View className="mt-3">
              {meals.map((meal, i) => {
                const on = ticked.has(meal.key);
                return (
                  <Animated.View key={meal.key} entering={reduceMotion ? undefined : FadeInDown.duration(240).delay(120 + Math.min(i, 8) * 50)}>
                    <Pressable
                      onPress={() => toggle(meal.key)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`${meal.name}, ${meal.savedLabel}`}
                      className="min-h-11 flex-row items-center gap-3 rounded-xl px-2 py-2.5 active:bg-primary/5"
                    >
                      <CheckBox checked={on} />
                      <View className="flex-1">
                        <Text numberOfLines={1} className="font-inter-semibold text-body-lg text-ink-emphasis">
                          {meal.name}
                        </Text>
                        <Text className="font-inter-regular text-small text-ink-subtle">{meal.savedLabel}</Text>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(200).delay(220)}>
              <View className="mt-6 flex-row gap-3">
                <View className="flex-1">
                  <Button variant="muted" label="Skip" onPress={() => close(true)} />
                </View>
                <View style={{ flex: 2 }}>
                  <Button label={cooked.length > 0 ? `Cooked · ${cooked.length}` : "Cooked"} onPress={next} disabled={cooked.length === 0} />
                </View>
              </View>
            </Animated.View>
          </Animated.View>
        ) : (
          <Animated.View key="usedUp" entering={forward}>
            <UsedUpBody
              groups={groups}
              onUpdate={finish}
              onBack={() => {
                Haptics.selectionAsync();
                setStep("meals");
              }}
            />
          </Animated.View>
        )}
      </View>
    </BottomSheet>
  );
}
