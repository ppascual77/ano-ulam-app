import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { mockMeals } from "@/frontend/core/meals/mocks/meals";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import type { MealType } from "@/frontend/core/meals/mealTypes";

// A small pull-tab that slides down from the top of Home at random
// intervals — for people who can't decide what to eat, drag it down to
// commit to a randomly-picked meal. Mirrors two existing patterns rather
// than inventing new ones: BottomSheet.tsx's Gesture.Pan()/scheduleOnRN
// structure for the drag mechanics, and CravingTagline.tsx's timer +
// reanimated conventions for the randomized scheduling. Mock data only for
// this first pass (see plan) — same 5-meal catalog Home/Browse/Discover
// already render elsewhere.

// Randomized per cycle so it never reads as a predictable metronome.
const APPEAR_DELAY_MIN_MS = 8000;
const APPEAR_DELAY_MAX_MS = 20000;
const IGNORE_TIMEOUT_MS = 6000; // how long it peeks, undragged, before retracting

const REST_LENGTH = 44; // resting cord+tab length once slid in
const MAX_PULL = 140; // visual cap on how far the cord can stretch while dragging
// Shifted off true-center so the tag doesn't sit dead-center over Header's
// content — a small, deliberate offset rather than a full-width centered
// element that visually dominates the top of the screen.
const TASSEL_OFFSET_X = 10;
const FADE_IN_DURATION_MS = 250;

const REVEAL_DISTANCE = 90; // past this much extra pull, commit to a reveal
const REVEAL_VELOCITY = 800; // same magnitude as BottomSheet's DISMISS_VELOCITY

const SPRING_BACK_DURATION_MS = 220; // mirrors BottomSheet's spring-back
const RETRACT_DURATION_MS = 280;
const REVEAL_SNAP_DURATION_MS = 120; // quick overshoot on commit
const REVEAL_RETRACT_DURATION_MS = 250;

// Entrance physics — a real hanging cord released at the top wouldn't slide
// down at a constant ease, it'd drop under gravity, overshoot its resting
// length, and swing a little before settling. withSpring (not withTiming)
// gives the vertical drop its bounce; the rotation is a second, independent
// spring from a random starting angle back to 0, so it reads as the whole
// tab swaying like a pendulum around its top attachment point rather than
// just a straight-line drop.
const ENTER_SPRING = { damping: 8, stiffness: 90, mass: 0.6 };
const SWAY_SPRING = { damping: 4, stiffness: 60, mass: 0.5 };
const SWAY_MAX_DEG = 14;

function pickRandomMeal(excludeId: string | null): MealType {
  const pool = excludeId ? mockMeals.filter((m) => m.id !== excludeId) : mockMeals;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function RandomMealPuller() {
  const [tabVisible, setTabVisible] = useState(false);
  const [revealedMeal, setRevealedMeal] = useState<MealType | null>(null);
  const lastMealIdRef = useRef<string | null>(null);
  const appearTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retractTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cordLength = useSharedValue(0);
  const dragStartLength = useSharedValue(0);
  const swayAngle = useSharedValue(0);
  const tabOpacity = useSharedValue(0);

  function scheduleNextAppearance() {
    const delay = APPEAR_DELAY_MIN_MS + Math.random() * (APPEAR_DELAY_MAX_MS - APPEAR_DELAY_MIN_MS);
    appearTimeoutRef.current = setTimeout(() => setTabVisible(true), delay);
  }

  useEffect(() => {
    scheduleNextAppearance();
    return () => {
      clearTimeout(appearTimeoutRef.current);
      clearTimeout(retractTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function retract() {
    tabOpacity.value = withTiming(0, { duration: RETRACT_DURATION_MS });
    cordLength.value = withTiming(0, { duration: RETRACT_DURATION_MS }, (finished) => {
      if (finished) scheduleOnRN(handleRetracted);
    });
  }
  function handleRetracted() {
    setTabVisible(false);
    scheduleNextAppearance();
  }

  // Entrance + auto-retract-if-ignored, keyed off tabVisible. On the commit
  // path below, tabVisible isn't flipped to false until the reveal
  // animation's own completion, so this effect's cleanup only ever cancels
  // the ignore-timer — it never re-triggers an entrance mid-reveal.
  useEffect(() => {
    if (!tabVisible) return;
    // Fades in rather than popping into view abruptly — plays alongside the
    // drop/sway, not before or after it.
    tabOpacity.value = withTiming(1, { duration: FADE_IN_DURATION_MS });
    cordLength.value = withSpring(REST_LENGTH, ENTER_SPRING);
    // Jump to a random starting lean, then spring back to hanging straight
    // (0deg) — the instantaneous jump plus the following spring assignment
    // is what makes it animate FROM that offset rather than just snapping.
    swayAngle.value = SWAY_MAX_DEG * (0.6 + Math.random() * 0.4) * (Math.random() < 0.5 ? -1 : 1);
    swayAngle.value = withSpring(0, SWAY_SPRING);
    retractTimeoutRef.current = setTimeout(retract, IGNORE_TIMEOUT_MS);
    return () => clearTimeout(retractTimeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabVisible]);

  function clearIgnoreTimer() {
    clearTimeout(retractTimeoutRef.current);
  }
  function resumeIgnoreTimer() {
    retractTimeoutRef.current = setTimeout(retract, IGNORE_TIMEOUT_MS);
  }
  function openMealSheet() {
    const meal = pickRandomMeal(lastMealIdRef.current);
    lastMealIdRef.current = meal.id ?? null;
    setRevealedMeal(meal);
  }
  function finishCommit() {
    setTabVisible(false);
  }

  const dragGesture = Gesture.Pan()
    .onStart(() => {
      dragStartLength.value = cordLength.value;
      scheduleOnRN(clearIgnoreTimer);
    })
    .onUpdate((e) => {
      cordLength.value = Math.min(MAX_PULL, Math.max(REST_LENGTH, dragStartLength.value + e.translationY));
    })
    .onEnd((e) => {
      if (e.translationY > REVEAL_DISTANCE || e.velocityY > REVEAL_VELOCITY) {
        // Committed: quick overshoot "snap", then retract while the sheet
        // opens underneath — the tab visually delivers the meal and leaves.
        cordLength.value = withTiming(MAX_PULL + 20, { duration: REVEAL_SNAP_DURATION_MS }, () => {
          tabOpacity.value = withTiming(0, { duration: REVEAL_RETRACT_DURATION_MS });
          cordLength.value = withTiming(0, { duration: REVEAL_RETRACT_DURATION_MS }, (finished) => {
            if (finished) scheduleOnRN(finishCommit);
          });
          scheduleOnRN(openMealSheet);
        });
      } else {
        cordLength.value = withTiming(REST_LENGTH, { duration: SPRING_BACK_DURATION_MS });
        scheduleOnRN(resumeIgnoreTimer);
      }
    });

  const cordStyle = useAnimatedStyle(() => ({ height: cordLength.value }));
  // Rotates the whole cord+tab group around its top edge — where it hangs
  // from — rather than its own center, so it actually reads as swinging
  // from a fixed point instead of spinning in place. The fixed
  // TASSEL_OFFSET_X rides along in the same transform (a plain constant,
  // not animated) to keep the tag off dead-center.
  const swayStyle = useAnimatedStyle(() => ({
    opacity: tabOpacity.value,
    transform: [{ translateX: TASSEL_OFFSET_X }, { rotate: `${swayAngle.value}deg` }],
    transformOrigin: ["50%", "0%", 0],
  }));

  return (
    <>
      {tabVisible && (
        <View pointerEvents="box-none" className="absolute left-0 right-0 top-0 items-center">
          <GestureDetector gesture={dragGesture}>
            <Animated.View
              collapsable={false}
              hitSlop={{ top: 8, bottom: 20, left: 20, right: 20 }}
              style={swayStyle}
              className="items-center"
            >
              <Animated.View style={cordStyle} className="w-[3px] rounded-full bg-ink-emphasis/20" />
              <View className="rounded-lg bg-tag-bg px-3 py-1.5 shadow-md">
                <Text className="font-handwritten text-ink-emphasis" style={{ fontSize: 18, lineHeight: 20 }} numberOfLines={1}>
                  Surprise me
                </Text>
              </View>
            </Animated.View>
          </GestureDetector>
        </View>
      )}

      <MealDetailSheet
        meal={revealedMeal}
        onClose={() => {
          setRevealedMeal(null);
          scheduleNextAppearance();
        }}
      />
    </>
  );
}
