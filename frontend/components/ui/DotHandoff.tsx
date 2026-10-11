import { type RefObject, useCallback, useEffect, useRef } from "react";
import { Dimensions, View } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { create } from "zustand";
import { colors } from "@/frontend/constants/theme";

// The landing dot handoff: moving between screens, the title dot of the
// screen you leave ("Categories.") flies over and lands as the title dot of
// the one you arrive at ("Browse."). No pairs to wire up: every LandingTitle
// records its dot when its screen loses focus, and asks for a flight from
// the last recorded dot when its screen gains focus. One overlay at the app
// root draws the flying dot, above the tab transition.
//
// Skipped when the arriving screen plays its intro (that lands its own
// dot), when either dot is off screen, and with Reduce motion on.

type Spot = { x: number; y: number; size: number };
// `to` starts as a prediction and is corrected (same id) once the new
// screen has settled and its dot can be measured for real.
type Flight = { id: number; from: Spot; to: Spot };

// The dot takes off right away toward where it predicts the new title's dot
// is, then corrects course once the tab's shift transition has settled
// enough to measure it.
const SETTLE_MS = 200;
const FLY_MS = 650;
// How long a course correction blends in (well inside the flight).
const CORRECT_MS = 220;
// How high the dot arcs between the two titles (they're often level).
const ARC = 70;
// How much the dot swells mid-flight, so it reads as a dot on the move.
const SWELL = 1.4;
// A dot left longer ago than this isn't where this screen came from (e.g.
// via Discover, which has no title dot).
const FRESH_MS = 800;
const MEASURE_TIMEOUT_MS = 150;
const DOT = 6;

type HandoffState = {
  enabled: boolean;
  /** Real dots hidden while the flying one stands in for them. */
  hidden: View[];
  flight: Flight | null;
};

const useHandoffStore = create<HandoffState>(() => ({ enabled: true, hidden: [], flight: null }));

let departed: { at: number; node: View; spot: Promise<Spot | null> } | null = null;
let flightCount = 0;
// Where each title dot was the last time it was seen on screen: the
// prediction for the next flight to it.
const lastSpot = new WeakMap<View, Spot>();

// A dot's center and size in window coordinates, or null when it isn't on
// screen (scrolled away) or can't be measured (already unmounted).
function measureSpot(node: View): Promise<Spot | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), MEASURE_TIMEOUT_MS);
    node.measureInWindow((x, y, w, h) => {
      clearTimeout(timer);
      const { height } = Dimensions.get("window");
      const cy = y + h / 2;
      resolve(w > 0 && cy > 0 && cy < height ? { x: x + w / 2, y: cy, size: w } : null);
    });
  });
}

function depart(node: View) {
  const spot = measureSpot(node);
  spot.then((s) => s && lastSpot.set(node, s));
  departed = { at: Date.now(), node, spot };
}

function finishFlight(id: number) {
  if (useHandoffStore.getState().flight?.id === id) useHandoffStore.setState({ hidden: [], flight: null });
}

async function arrive(node: View, canLand: () => boolean) {
  const last = departed;
  departed = null;
  if (!last || last.node === node || Date.now() - last.at > FRESH_MS) return;
  if (!useHandoffStore.getState().enabled || !canLand()) return;
  const from = await last.spot;
  if (!from) return;

  // Predict where it lands: where this dot was last seen. First time, the
  // dot as it is now, mid-slide: its height is already right (tabs slide
  // sideways), and titles all start at the same left edge, so the old
  // dot's x is the best guess for now.
  const now = lastSpot.get(node) ? null : await measureSpot(node);
  const predicted = lastSpot.get(node) ?? (now ? { ...now, x: from.x } : from);

  // The flying dot takes over from both real ones and sets off right away.
  const id = ++flightCount;
  useHandoffStore.setState({ hidden: [last.node, node], flight: { id, from, to: predicted } });
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
  if (useHandoffStore.getState().flight?.id !== id) return;
  const to = await measureSpot(node);
  if (!to) return; // Off screen: it finishes at the prediction.
  lastSpot.set(node, to);
  useHandoffStore.setState({ flight: { id, from, to } });
}

/** For LandingTitle: hand its dot off between screens. `canLand` is false
 *  while the screen's intro is due to land the dot itself (then it neither
 *  takes a flight nor launches one). */
export function useDotHandoff(dotRef: RefObject<View | null>, canLand: () => boolean) {
  const canLandRef = useRef(canLand);
  canLandRef.current = canLand;
  useFocusEffect(
    useCallback(() => {
      // A tick later, so the screen being left has recorded its dot (blur
      // and focus can come in either order).
      const timer = setTimeout(() => {
        if (dotRef.current) void arrive(dotRef.current, () => canLandRef.current());
      }, 0);
      return () => {
        clearTimeout(timer);
        // Only a dot that's showing (not one still waiting on its intro).
        if (dotRef.current && canLandRef.current()) depart(dotRef.current);
      };
    }, [dotRef]),
  );
  return useHandoffStore((s) => !!dotRef.current && s.hidden.includes(dotRef.current));
}

/** The flying dot. Mount once at the app root, above the navigator. */
export function DotHandoffOverlay({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    useHandoffStore.setState(enabled ? { enabled } : { enabled, hidden: [], flight: null });
  }, [enabled]);

  const flight = useHandoffStore((s) => s.flight);
  const rootRef = useRef<View>(null);
  const fly = useSharedValue(0);
  const shown = useSharedValue(0);
  const from = useSharedValue<Spot>({ x: 0, y: 0, size: DOT });
  const toX = useSharedValue(0);
  const toY = useSharedValue(0);
  const toSize = useSharedValue(DOT);
  const flyingId = useRef<number | null>(null);

  useEffect(() => {
    if (!flight) {
      shown.value = 0;
      flyingId.current = null;
      return;
    }
    // Window coordinates, made relative to this overlay (the app can be
    // letterboxed on iPad).
    rootRef.current?.measureInWindow((ox, oy) => {
      const tx = flight.to.x - ox;
      const ty = flight.to.y - oy;
      if (flyingId.current === flight.id) {
        // A course correction: blend toward the measured spot mid-flight.
        const blend = { duration: CORRECT_MS, easing: Easing.out(Easing.cubic) };
        toX.value = withTiming(tx, blend);
        toY.value = withTiming(ty, blend);
        toSize.value = withTiming(flight.to.size, blend);
        return;
      }
      flyingId.current = flight.id;
      from.value = { x: flight.from.x - ox, y: flight.from.y - oy, size: flight.from.size };
      toX.value = tx;
      toY.value = ty;
      toSize.value = flight.to.size;
      shown.value = 1;
      fly.value = 0;
      fly.value = withTiming(1, { duration: FLY_MS, easing: Easing.inOut(Easing.cubic) }, (done) => {
        if (done) scheduleOnRN(finishFlight, flight.id);
      });
    });
  }, [flight]);

  const dotStyle = useAnimatedStyle(() => {
    const f = fly.value;
    const a = from.value;
    const x = a.x + (toX.value - a.x) * f;
    const y = a.y + (toY.value - a.y) * f - ARC * 4 * f * (1 - f);
    const size = a.size + (toSize.value - a.size) * f;
    const scale = (size / DOT) * (1 + (SWELL - 1) * Math.sin(Math.PI * f));
    return {
      opacity: shown.value,
      transform: [{ translateX: x - DOT / 2 }, { translateY: y - DOT / 2 }, { scale }],
    };
  });

  return (
    <View ref={rootRef} collapsable={false} pointerEvents="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 100 }}>
      <Animated.View
        style={[
          { position: "absolute", left: 0, top: 0, width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.accent },
          dotStyle,
        ]}
      />
    </View>
  );
}
