import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View, type ViewInstance } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { colors } from "@/frontend/constants/theme";

// A page's "quick glance" intro (the auto tour): a full-screen scene over a
// white cover, ending with one dot that flies up and lands on a spot in the
// real page's header (e.g. the period of "Price Watch."). The page supplies
// the scene; this handles the cover, skipping, measuring and the flight.
//
// Two layers: an in-page cover, up while the intro is armed so the page
// never flashes before it plays, and, while it plays, a full-screen Modal
// over everything (status bar and bottom nav too) holding the scene and
// the dot. Both covers fade together as the dot takes off. The Modal only
// shows while playing: an armed intro waits on a hidden tab, and a Modal
// there would cover whichever tab is showing.

const FADE_MS = 450;
const CONTENT_FADE_MS = 250;
export const INTRO_DOT_FLY_MS = 650;
// How high the dot arcs on its way to the header.
export const INTRO_DOT_FLY_ARC = 120;
const FLY_MS = INTRO_DOT_FLY_MS;
const FLY_ARC = INTRO_DOT_FLY_ARC;
// Part way through the flight the landing spot is measured again and the
// dot eases onto where it really is (the header can still shift a little
// while the cover fades); on arrival, a last check glides it the final
// pixels instead of letting the real dot pop in beside it.
const CORRECT_AT = 0.55;
const CORRECT_MS = 220;
const SETTLE_MS = 120;

// How long the dot sits still between popping in (dotAt) and taking off
// (flyAt), so its pop has settled and the flight starts from rest. Price
// Watch's timing, the smoothest landing; every intro uses it.
export const INTRO_DOT_REST_MS = 660;

export type IntroSize = { w: number; h: number };
export type IntroState = "armed" | "playing" | "done";

// Arms the intro before the page is ever shown (first render, and again
// whenever the tab is left), so the page never flashes before it; focusing
// the page plays it.
export function usePageIntro({
  enabled,
  onArm,
  onFinish,
}: {
  enabled: boolean;
  onArm?: () => void;
  /** Landed, skipped, or left partway (switching away mid-intro): any of
   *  these counts as seen, e.g. to remember it so it plays only once. */
  onFinish?: () => void;
}) {
  const [state, setState] = useState<IntroState>(enabled ? "armed" : "done");
  // The dot has arrived: the real landing spot shows while the overlay (with
  // the flying dot on top of it) stays up two more frames, so the swap from
  // one dot to the other can't blink or double up.
  const [landing, setLanding] = useState(false);
  // Once per play: a skip and the flight's own end can both call finish.
  const finishing = useRef(false);
  const [run, setRun] = useState(0);
  const targetRef = useRef<ViewInstance>(null);
  const onArmRef = useRef(onArm);
  onArmRef.current = onArm;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      finishing.current = false;
      setLanding(false);
      setState("playing");
      return () => {
        // Leaving the page: it's been seen, even if it didn't finish. Re-arm
        // while hidden in case it's still due (a page that plays every visit).
        onFinishRef.current?.();
        onArmRef.current?.();
        setRun((n) => n + 1);
        setLanding(false);
        setState("armed");
      };
    }, [enabled]),
  );
  const finish = useCallback(() => {
    if (finishing.current) return;
    finishing.current = true;
    setLanding(true);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setState((prev) => (prev === "playing" ? "done" : prev));
        onFinishRef.current?.();
      }),
    );
  }, []);
  // Turned off (e.g. Reduce motion switched on): drop the cover right away.
  // Turned on later (e.g. once "seen intros" has loaded, after the page
  // first rendered): arm, so the page doesn't show before it plays.
  useEffect(() => {
    setState((prev) => (!enabled ? "done" : prev === "done" ? "armed" : prev));
  }, [enabled]);

  return {
    /** Render the PageIntro while this is true. */
    showing: state !== "done",
    /** Pass to PageIntro: false keeps just the cover up, true plays. */
    active: state === "playing",
    /** PageIntro's key, so each visit replays from the start. */
    run,
    /** Put on the header's landing spot (a View, collapsable={false}). */
    targetRef,
    /** Hide the landing spot until the flying dot gets there. */
    landed: state === "done" || landing,
    finish,
  };
}

type PageIntroProps = {
  /** false: only the white cover, waiting. true: plays the scene. */
  active: boolean;
  /** Where the dot lands: the page header's dot (see usePageIntro). */
  targetRef: RefObject<ViewInstance | null>;
  /** Landed, or skipped: show the page. */
  onDone: () => void;
  /** The scene, mounted (and so started) when `active` turns true. It
   *  fades out as the dot takes off. */
  children: (size: IntroSize) => ReactNode;
  /** Where the dot appears, in the overlay's coordinates. Read at `dotAt`. */
  dotStart: (size: IntroSize) => { x: number; y: number };
  /** When the dot pops in at dotStart, ms after the scene starts. */
  dotAt: number;
  /** When the cover fades and the dot takes off. */
  flyAt: number;
  /** The dot's size while it's in the scene. */
  dotSize?: number;
  /** The dot turns this color as it lands (e.g. a logo's green). */
  landColor?: string;
  /** "dark": a black cover, for a dark page (Discover's reel). */
  tone?: "light" | "dark";
  accessibilityLabel: string;
};

export function PageIntro({
  active,
  targetRef,
  onDone,
  children,
  dotStart,
  dotAt,
  flyAt,
  dotSize = 22,
  landColor = colors.accent,
  tone = "light",
  accessibilityLabel,
}: PageIntroProps) {
  const rootRef = useRef<ViewInstance>(null);
  const [size, setSize] = useState<IntroSize | null>(null);

  const dot = useSharedValue(0);
  const content = useSharedValue(1);
  const backdrop = useSharedValue(1);
  const fly = useSharedValue(0);
  const start = useSharedValue({ x: 0, y: 0 });
  // The landing spot's center and size, in this overlay's coordinates.
  const targetX = useSharedValue(0);
  const targetY = useSharedValue(0);
  const targetSize = useSharedValue(6);

  useEffect(() => {
    if (!size || !active) return;
    // dotStart is read when the dot pops in (not up front), so a scene can
    // hand over a spot it only measures once it's on screen.
    const popTimer = setTimeout(() => {
      start.value = dotStart(size);
      dot.value = withSequence(withSpring(1.25, { damping: 6, stiffness: 300 }), withSpring(1));
    }, dotAt);

    // The landing spot's center and size, relative to this overlay.
    const measureTarget = (then: (spot: { x: number; y: number; size: number } | null) => void) => {
      const root = rootRef.current;
      const dest = targetRef.current;
      if (!root || !dest) return then(null);
      root.measureInWindow((rx, ry) => {
        dest.measureInWindow((tx, ty, tw, th) => then({ x: tx - rx + tw / 2, y: ty - ry + th / 2, size: Math.max(tw, 1) }));
      });
    };
    let correctTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    // On arrival: one last measure; if the spot moved, glide the last bit.
    const arrive = () => {
      if (cancelled) return;
      measureTarget((spot) => {
        if (cancelled) return;
        if (spot && (Math.abs(spot.x - targetX.value) > 0.5 || Math.abs(spot.y - targetY.value) > 0.5)) {
          const glide = { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) };
          targetX.value = withTiming(spot.x, glide);
          targetY.value = withTiming(spot.y, glide, (done) => {
            if (done) scheduleOnRN(onDone);
          });
          return;
        }
        onDone();
      });
    };

    // Measure the landing spot just before the flight (the page has laid
    // out by then), then fly there, correcting course part way.
    const timer = setTimeout(() => {
      measureTarget((spot) => {
        if (cancelled) return;
        if (!spot) {
          onDone();
          return;
        }
        targetX.value = spot.x;
        targetY.value = spot.y;
        targetSize.value = spot.size;
        content.value = withTiming(0, { duration: CONTENT_FADE_MS });
        backdrop.value = withTiming(0, { duration: FADE_MS });
        fly.value = withTiming(1, { duration: FLY_MS, easing: Easing.inOut(Easing.cubic) }, (done) => {
          if (done) scheduleOnRN(arrive);
        });
        correctTimer = setTimeout(() => {
          measureTarget((now) => {
            if (cancelled || !now) return;
            const blend = { duration: CORRECT_MS, easing: Easing.out(Easing.cubic) };
            targetX.value = withTiming(now.x, blend);
            targetY.value = withTiming(now.y, blend);
            targetSize.value = withTiming(now.size, blend);
          });
        }, FLY_MS * CORRECT_AT);
      });
    }, flyAt);
    return () => {
      cancelled = true;
      clearTimeout(popTimer);
      clearTimeout(timer);
      clearTimeout(correctTimer);
    };
    // Once it's active and sized; the rest are stable for a run.
  }, [size, active]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: content.value }));
  const dotStyle = useAnimatedStyle(() => {
    const f = fly.value;
    const s = start.value;
    const x = s.x + (targetX.value - s.x) * f;
    const y = s.y + (targetY.value - s.y) * f - FLY_ARC * 4 * f * (1 - f);
    // Shrinks from its scene size to exactly the landing spot's size.
    const scale = dot.value * (1 + (targetSize.value / dotSize - 1) * f);
    return {
      opacity: dot.value > 0 ? 1 : 0,
      backgroundColor: interpolateColor(f, [0.55, 1], [colors.accent, landColor]),
      transform: [{ translateX: x - dotSize / 2 }, { translateY: y - dotSize / 2 }, { scale }],
    };
  });

  return (
    <>
      {/* In-page cover: hides the page from the moment it's armed. */}
      <Animated.View
        pointerEvents={active ? "none" : "auto"}
        className={`absolute bottom-0 left-0 right-0 top-0 ${tone === "dark" ? "bg-black" : "bg-white"}`}
        style={[{ zIndex: 50 }, backdropStyle]}
      />

      <Modal
        visible={active}
        transparent
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={onDone}
      >
        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityLabel} Tap to skip.`}
          className="flex-1"
        >
          <View
            ref={rootRef}
            collapsable={false}
            className="flex-1"
            onLayout={(e) => {
              const { width: w, height: h } = e.nativeEvent.layout;
              setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
            }}
          >
            <Animated.View
              pointerEvents="none"
              className={`absolute bottom-0 left-0 right-0 top-0 ${tone === "dark" ? "bg-black" : "bg-white"}`}
              style={backdropStyle}
            />

            {size && (
              <Animated.View pointerEvents="none" className="flex-1" style={contentStyle}>
                {children(size)}
                <Text
                  className={`absolute bottom-10 left-0 right-0 text-center font-inter-regular text-small ${
                    tone === "dark" ? "text-white/50" : "text-ink-placeholder"
                  }`}
                >
                  Tap to skip
                </Text>
              </Animated.View>
            )}

            {/* Outside the scene layer, so it stays as the scene fades. */}
            <Animated.View
              pointerEvents="none"
              style={[{ position: "absolute", left: 0, top: 0, width: dotSize, height: dotSize, borderRadius: dotSize / 2 }, dotStyle]}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
