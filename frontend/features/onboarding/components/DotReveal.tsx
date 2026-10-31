import { type RefObject, useEffect, useRef } from "react";
import { useWindowDimensions, View, type ViewInstance } from "react-native";
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { create } from "zustand";
import { HOP_MARKER_SIZE, type DotSpot } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

// Get Started's way into onboarding, "the dot opens the door": the button has
// shrunk to an orange dot (DotMorphButton). The dot swells until it fills the
// screen, onboarding swaps in under it, then it shrinks away toward the page
// indicator's first dot, uncovering onboarding as it goes, and lands there as
// the indicator's pill.
//
// The dot outlives the intro screen, so it's drawn by one overlay at the app
// root, like DotHandoffOverlay.

type Reveal = { id: number; from: DotSpot; onCovered: () => void };

type RevealState = {
  reveal: Reveal | null;
  /** The indicator's first dot, measured fresh whenever it's needed (a
   *  spot measured as onboarding mounts can be off: it isn't settled yet). */
  target: RefObject<ViewInstance | null> | null;
  /** The dot has become the indicator's pill: onboarding takes over. */
  landed: boolean;
};

const useRevealStore = create<RevealState>(() => ({ reveal: null, target: null, landed: false }));
let revealCount = 0;

/** Intro: the Get Started dot at `from` (window coordinates) opens the door.
 *  `onCovered` runs once the screen is all orange: switch screens then. */
export function startDotReveal(from: DotSpot, onCovered: () => void) {
  useRevealStore.setState({ reveal: { id: ++revealCount, from, onCovered }, target: null, landed: false });
}

/** Onboarding: its indicator's first dot, where the dot lands. */
export function setDotRevealTarget(target: RefObject<ViewInstance | null>) {
  if (useRevealStore.getState().reveal) useRevealStore.setState({ target });
}

// The target's center in window coordinates, or null if it can't be
// measured yet.
function measureTarget(done: (spot: P | null) => void) {
  const node = useRevealStore.getState().target?.current;
  if (!node) return done(null);
  node.measureInWindow((x, y, w, h) => done(w ? { x: x + w / 2, y: y + h / 2 } : null));
}

/** Onboarding: true until the dot has landed as its indicator's marker. */
export function useDotRevealArriving() {
  return useRevealStore((s) => !!s.reveal && !s.landed);
}

// Swelling to fill the screen.
const GROW_MS = 520;
const GROW_EASE = Easing.bezier(0.6, 0, 0.35, 1);
// All orange: long enough for onboarding to mount and measure its dot.
const HOLD_MS = 140;
// Waiting on that measurement past the hold, at most.
const TARGET_WAIT_MS = 400;
// Shrinking away onto the indicator: quick to uncover, gentle to land.
const SHRINK_MS = 640;
const SHRINK_EASE = Easing.bezier(0.5, 0, 0.15, 1);
// Re-measured partway down (the screen has long settled by then), and any
// difference blended in well before landing.
const CORRECT_AT_MS = 280;
const CORRECT_MS = 180;
const FLATTEN_SPRING = { damping: 11, stiffness: 240, mass: 0.6 };

const BALL = HOP_MARKER_SIZE.dot.width;
const PILL = HOP_MARKER_SIZE.pill;

type P = { x: number; y: number };

/** Mount once at the app root, above the navigator. */
export function DotRevealOverlay() {
  const reveal = useRevealStore((s) => s.reveal);
  const landed = useRevealStore((s) => s.landed);
  const rootRef = useRef<ViewInstance>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // In this overlay's coordinates.
  const from = useSharedValue<DotSpot>({ x: 0, y: 0, size: BALL });
  const to = useSharedValue<P>({ x: 0, y: 0 });
  // Big enough to cover the screen from where the dot started.
  const cover = useSharedValue(0);
  const shown = useSharedValue(0);
  // 0 -> 1: swelling. 0 -> 1: shrinking onto the indicator. 0 -> 1: the
  // landed ball flattening into the pill.
  const grow = useSharedValue(0);
  const shrink = useSharedValue(0);
  const flat = useSharedValue(0);
  const impact = useSharedValue(0);

  useEffect(() => {
    if (!reveal) {
      shown.value = 0;
      return;
    }
    let cancelled = false;
    const current = () => !cancelled && useRevealStore.getState().reveal?.id === reveal.id;

    rootRef.current?.measureInWindow((ox, oy) => {
      if (!current()) return;
      const start = { x: reveal.from.x - ox, y: reveal.from.y - oy, size: reveal.from.size };
      from.value = start;
      cover.value = Math.max(Math.hypot(start.x, start.y), Math.hypot(width - start.x, start.y), Math.hypot(start.x, height - start.y), Math.hypot(width - start.x, height - start.y)) + 4;
      grow.value = 0;
      shrink.value = 0;
      flat.value = 0;
      impact.value = 0;
      shown.value = 1;

      const shrinkAway = (spot: P | null) => {
        if (!current()) return;
        // A best guess (bottom-left, by the arrow button) if onboarding's
        // dot couldn't be measured in time; corrected below.
        to.value = spot ? { x: spot.x - ox, y: spot.y - oy } : { x: 40 + PILL.width / 2, y: height - insets.bottom - 24 - 28 };
        shrink.value = withTiming(1, { duration: SHRINK_MS, easing: SHRINK_EASE });
        setTimeout(() => {
          if (!current()) return;
          measureTarget((now) => {
            if (!now || !current()) return;
            to.value = withTiming({ x: now.x - ox, y: now.y - oy }, { duration: CORRECT_MS, easing: Easing.out(Easing.cubic) });
          });
        }, CORRECT_AT_MS);
      };
      const covered = () => {
        if (!current()) return;
        reveal.onCovered();
        const coveredAt = Date.now();
        const tryShrink = () => {
          if (!current()) return;
          const waited = Date.now() - coveredAt;
          if (waited < HOLD_MS) {
            setTimeout(tryShrink, 16);
            return;
          }
          measureTarget((spot) => {
            if (!spot && Date.now() - coveredAt < HOLD_MS + TARGET_WAIT_MS) {
              setTimeout(tryShrink, 16);
              return;
            }
            shrinkAway(spot);
          });
        };
        tryShrink();
      };
      grow.value = withTiming(1, { duration: GROW_MS, easing: GROW_EASE }, (finished) => {
        if (finished) scheduleOnRN(covered);
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);

  // Touch-down: a light tap, a squash, then it flattens into the pill and
  // onboarding's real marker takes over.
  const onTouchDown = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const onFlattened = (id: number) => {
    if (useRevealStore.getState().reveal?.id !== id) return;
    useRevealStore.setState({ landed: true });
    // A frame later, once the real marker is showing.
    setTimeout(() => {
      if (useRevealStore.getState().reveal?.id === id) useRevealStore.setState({ reveal: null, target: null, landed: false });
    }, 50);
  };
  const revealId = reveal?.id ?? 0;
  useAnimatedReaction(
    () => shrink.value >= 1,
    (arrived, was) => {
      if (!arrived || was) return;
      scheduleOnRN(onTouchDown);
      impact.value = withSequence(withTiming(1, { duration: 70, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 9, stiffness: 300, mass: 0.5 }));
      flat.value = withSpring(1, FLATTEN_SPRING, (finished) => {
        if (finished) scheduleOnRN(onFlattened, revealId);
      });
    },
    [revealId],
  );

  const discStyle = useAnimatedStyle(() => {
    const a = from.value;
    const s = shrink.value;
    let x: number;
    let y: number;
    let w: number;
    let h: number;
    if (s <= 0) {
      // Swelling from the button's dot to cover the screen.
      const r = a.size / 2 + (cover.value - a.size / 2) * grow.value;
      x = a.x;
      y = a.y;
      w = h = r * 2;
    } else {
      // Shrinking onto the indicator, its center gliding there as it goes.
      const b = to.value;
      x = a.x + (b.x - a.x) * s;
      y = a.y + (b.y - a.y) * s;
      w = h = 2 * (cover.value + (BALL / 2 - cover.value) * s);
      if (s >= 1) {
        // Landed: flatten into the pill.
        const f = flat.value;
        w = BALL + (PILL.width - BALL) * f;
        h = BALL + (PILL.height - BALL) * Math.min(f, 1);
      }
    }
    const q = impact.value * 0.25;
    return {
      opacity: shown.value,
      width: w,
      height: h,
      borderRadius: h / 2,
      transform: [{ translateX: x - w / 2 }, { translateY: y - h / 2 }, { scaleX: 1 + q }, { scaleY: 1 - q }],
    };
  });

  return (
    <View ref={rootRef} collapsable={false} pointerEvents="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 100 }}>
      {reveal && !landed && <Animated.View style={[{ position: "absolute", left: 0, top: 0, backgroundColor: colors.accent }, discStyle]} />}
    </View>
  );
}
