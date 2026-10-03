import { useEffect, useRef, useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { colors } from "@/frontend/constants/theme";
import { mockMeals } from "@/frontend/core/meals/mocks/meals";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { MealRevealCard } from "./MealRevealCard";

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

const REST_LENGTH = 70; // resting cord+tab length once slid in
const MAX_PULL = 200; // visual cap on how far the cord can stretch while dragging
// Shifted off true-center so the tag doesn't sit dead-center over Header's
// content — a small, deliberate offset rather than a full-width centered
// element that visually dominates the top of the screen.
const TASSEL_OFFSET_X = 70;
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
const SWAY_MAX_DEG = 30;

// While the user is actively holding/dragging, the tab leans toward
// wherever their finger has moved horizontally — but a real rope doesn't
// track a hand 1:1, it lags and catches up. Re-issuing withSpring on every
// pointer-move event (below, in onUpdate) toward a constantly-moving
// target is what gives that lag: reanimated smoothly retargets an in-flight
// spring rather than restarting it, so the tab visibly "chases" the finger
// instead of snapping straight to it. Looser than SWAY_SPRING (lower
// stiffness, less damping) since this needs to feel floppy while held, not
// crisply settle like the entrance/release springs do.
const DRAG_SWAY_SPRING = { damping: 6, stiffness: 50, mass: 0.4 };
const DRAG_SWAY_MAX_DEG = 40;
// Degrees of lean per pixel of horizontal drag — tuned so the lean reaches
// close to DRAG_SWAY_MAX_DEG around a natural ~100px sideways pull, not a
// full screen-width drag.
const DRAG_SWAY_SENSITIVITY = -0.4; // negative: dragging right should lean the tab right, not left

// Confetti burst when a pull actually commits to a reveal — celebrates the
// "surprise me" moment, not shown on a spring-back or an ignored retract.
// Rendered inside the reveal card's own Modal (its `overlay`) rather than
// a second Modal: React Native doesn't reliably present two native Modals
// at once. Fires when the card lands face up.
// The reveal card's fade-out (MealRevealCard's EXIT_MS) plus a margin,
// before the meal sheet opens.
const DETAIL_AFTER_CARD_MS = 320;
const CONFETTI_COLORS = [colors.primary, colors.accent, colors.like, colors.macro.protein, colors.macro.carbs, colors.macro.fats];
const CONFETTI_COUNT = 26;
const CONFETTI_SIZE_SCALE = 1.2; // 20% larger than the original base size
// Longest any single piece could still be falling: max delay (400) + max
// fallDuration (1800+900=2700) = 3100ms. Kept mounted comfortably past that
// so every piece finishes its own per-piece fade-out (see ConfettiPiece)
// before the whole overlay unmounts — nothing should visibly cut off.
const CONFETTI_LIFETIME_MS = 3400;
// The overlay's own fade-out right before it unmounts, as a safety net on
// top of each piece's individual fade — Modal has no built-in exit
// animation with animationType="none", so without this the whole thing
// would otherwise just vanish on one frame instead of dissolving smoothly.
const CONFETTI_EXIT_FADE_MS = 300;

type ConfettiPieceConfig = {
  startX: number;
  color: string;
  width: number;
  height: number;
  delay: number;
  fallDuration: number;
  rotations: number;
  drift: number;
};

function buildConfettiPieces(screenWidth: number): ConfettiPieceConfig[] {
  return Array.from({ length: CONFETTI_COUNT }, () => {
    const size = (6 + Math.random() * 6) * CONFETTI_SIZE_SCALE;
    return {
      startX: Math.random() * screenWidth,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      width: size,
      height: size * 0.4,
      delay: Math.random() * 400,
      fallDuration: 1800 + Math.random() * 900,
      rotations: (180 + Math.random() * 540) * (Math.random() < 0.5 ? -1 : 1),
      drift: (Math.random() - 0.5) * 100,
    };
  });
}

function ConfettiPiece({ config, screenHeight }: { config: ConfettiPieceConfig; screenHeight: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(config.delay, withTiming(1, { duration: config.fallDuration }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pieceStyle = useAnimatedStyle(() => {
    const translateY = interpolate(progress.value, [0, 1], [-20, screenHeight + 20]);
    const translateX = interpolate(progress.value, [0, 1], [0, config.drift]);
    const rotate = interpolate(progress.value, [0, 1], [0, config.rotations]);
    const opacity = interpolate(progress.value, [0, 0.85, 1], [1, 1, 0]);
    return {
      opacity,
      transform: [{ translateX: config.startX + translateX }, { translateY }, { rotate: `${rotate}deg` }],
    };
  });

  return (
    <Animated.View
      style={[
        pieceStyle,
        {
          position: "absolute",
          top: 0,
          left: 0,
          width: config.width,
          height: config.height,
          backgroundColor: config.color,
          borderRadius: 1,
        },
      ]}
    />
  );
}

function pickRandomMeal(excludeId: string | null): MealType {
  const pool = excludeId ? mockMeals.filter((m) => m.id !== excludeId) : mockMeals;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function RandomMealPuller() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [tabVisible, setTabVisible] = useState(false);
  // The flip-card reveal, then (on "View Details") the full sheet.
  const [revealedMeal, setRevealedMeal] = useState<MealType | null>(null);
  const [detailMeal, setDetailMeal] = useState<MealType | null>(null);
  const [confettiPieces, setConfettiPieces] = useState<ConfettiPieceConfig[] | null>(null);
  const lastMealIdRef = useRef<string | null>(null);
  const appearTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retractTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const detailTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const confettiFadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const confettiClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cordLength = useSharedValue(0);
  const dragStartLength = useSharedValue(0);
  const swayAngle = useSharedValue(0);
  const tabOpacity = useSharedValue(0);
  const confettiOpacity = useSharedValue(1);

  function scheduleNextAppearance() {
    const delay = APPEAR_DELAY_MIN_MS + Math.random() * (APPEAR_DELAY_MAX_MS - APPEAR_DELAY_MIN_MS);
    appearTimeoutRef.current = setTimeout(() => setTabVisible(true), delay);
  }

  useEffect(() => {
    scheduleNextAppearance();
    return () => {
      clearTimeout(appearTimeoutRef.current);
      clearTimeout(retractTimeoutRef.current);
      clearTimeout(detailTimeoutRef.current);
      clearTimeout(confettiFadeTimeoutRef.current);
      clearTimeout(confettiClearTimeoutRef.current);
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
  function burstConfetti() {
    confettiOpacity.value = 1;
    setConfettiPieces(buildConfettiPieces(screenWidth));
    confettiFadeTimeoutRef.current = setTimeout(() => {
      confettiOpacity.value = withTiming(0, { duration: CONFETTI_EXIT_FADE_MS });
    }, CONFETTI_LIFETIME_MS - CONFETTI_EXIT_FADE_MS);
    confettiClearTimeoutRef.current = setTimeout(() => setConfettiPieces(null), CONFETTI_LIFETIME_MS);
  }
  // The card fades out first, then the sheet opens (never two Modals up at
  // once; see the confetti note above).
  function openDetails(meal: MealType) {
    setRevealedMeal(null);
    setConfettiPieces(null);
    detailTimeoutRef.current = setTimeout(() => setDetailMeal(meal), DETAIL_AFTER_CARD_MS);
  }
  function dismissReveal() {
    setRevealedMeal(null);
    setConfettiPieces(null);
    scheduleNextAppearance();
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
      const targetAngle = Math.max(
        -DRAG_SWAY_MAX_DEG,
        Math.min(DRAG_SWAY_MAX_DEG, e.translationX * DRAG_SWAY_SENSITIVITY),
      );
      swayAngle.value = withSpring(targetAngle, DRAG_SWAY_SPRING);
    })
    .onEnd((e) => {
      if (e.translationY > REVEAL_DISTANCE || e.velocityY > REVEAL_VELOCITY) {
        // Committed: quick overshoot "snap", then retract while the card
        // reveal opens — the tab visually delivers the meal and leaves.
        cordLength.value = withTiming(MAX_PULL + 20, { duration: REVEAL_SNAP_DURATION_MS }, () => {
          tabOpacity.value = withTiming(0, { duration: REVEAL_RETRACT_DURATION_MS });
          swayAngle.value = withSpring(0, SWAY_SPRING);
          cordLength.value = withTiming(0, { duration: REVEAL_RETRACT_DURATION_MS }, (finished) => {
            if (finished) scheduleOnRN(finishCommit);
          });
          scheduleOnRN(openMealSheet);
        });
      } else {
        cordLength.value = withTiming(REST_LENGTH, { duration: SPRING_BACK_DURATION_MS });
        // Letting go mid-lean shouldn't leave it hanging crooked — swings
        // back to straight with the same pendulum-settle feel as the
        // entrance, not the loose drag-follow spring.
        swayAngle.value = withSpring(0, SWAY_SPRING);
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
  const confettiContainerStyle = useAnimatedStyle(() => ({ opacity: confettiOpacity.value }));

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

      <MealRevealCard
        meal={revealedMeal}
        onLanded={burstConfetti}
        onViewDetails={openDetails}
        onDismiss={dismissReveal}
        overlay={
          confettiPieces ? (
            <Animated.View pointerEvents="none" style={confettiContainerStyle} className="absolute left-0 right-0 top-0 bottom-0">
              {confettiPieces.map((piece, i) => (
                <ConfettiPiece key={i} config={piece} screenHeight={screenHeight} />
              ))}
            </Animated.View>
          ) : undefined
        }
      />

      <MealDetailSheet
        meal={detailMeal}
        onClose={() => {
          setDetailMeal(null);
          scheduleNextAppearance();
        }}
      />
    </>
  );
}
