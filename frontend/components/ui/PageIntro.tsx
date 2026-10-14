import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
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
  /** Landed or skipped (e.g. to remember it's been seen). */
  onFinish?: () => void;
}) {
  const [state, setState] = useState<IntroState>(enabled ? "armed" : "done");
  const [run, setRun] = useState(0);
  const targetRef = useRef<View>(null);
  const onArmRef = useRef(onArm);
  onArmRef.current = onArm;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      setState("playing");
      return () => {
        // Leaving the page: re-arm while it's hidden, ready for next time.
        onArmRef.current?.();
        setRun((n) => n + 1);
        setState("armed");
      };
    }, [enabled]),
  );
  const finish = useCallback(() => {
    setState("done");
    onFinishRef.current?.();
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
    landed: state === "done",
    finish,
  };
}

type PageIntroProps = {
  /** false: only the white cover, waiting. true: plays the scene. */
  active: boolean;
  /** Where the dot lands: the page header's dot (see usePageIntro). */
  targetRef: RefObject<View | null>;
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
  const rootRef = useRef<View>(null);
  const [size, setSize] = useState<IntroSize | null>(null);

  const dot = useSharedValue(0);
  const content = useSharedValue(1);
  const backdrop = useSharedValue(1);
  const fly = useSharedValue(0);
  const start = useSharedValue({ x: 0, y: 0 });
  // The landing spot's center and size, in this overlay's coordinates.
  const target = useSharedValue({ x: 0, y: 0, size: 6 });

  useEffect(() => {
    if (!size || !active) return;
    // dotStart is read when the dot pops in (not up front), so a scene can
    // hand over a spot it only measures once it's on screen.
    const popTimer = setTimeout(() => {
      start.value = dotStart(size);
      dot.value = withSequence(withSpring(1.25, { damping: 6, stiffness: 300 }), withSpring(1));
    }, dotAt);

    // Measure the landing spot just before the flight (the page has laid
    // out by then), then fly there.
    const timer = setTimeout(() => {
      const root = rootRef.current;
      const dest = targetRef.current;
      if (!root || !dest) {
        onDone();
        return;
      }
      root.measureInWindow((rx, ry) => {
        dest.measureInWindow((tx, ty, tw, th) => {
          target.value = { x: tx - rx + tw / 2, y: ty - ry + th / 2, size: Math.max(tw, 1) };
          content.value = withTiming(0, { duration: CONTENT_FADE_MS });
          backdrop.value = withTiming(0, { duration: FADE_MS });
          fly.value = withTiming(1, { duration: FLY_MS, easing: Easing.inOut(Easing.cubic) }, (done) => {
            if (done) scheduleOnRN(onDone);
          });
        });
      });
    }, flyAt);
    return () => {
      clearTimeout(popTimer);
      clearTimeout(timer);
    };
    // Once it's active and sized; the rest are stable for a run.
  }, [size, active]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: content.value }));
  const dotStyle = useAnimatedStyle(() => {
    const f = fly.value;
    const s = start.value;
    const t = target.value;
    const x = s.x + (t.x - s.x) * f;
    const y = s.y + (t.y - s.y) * f - FLY_ARC * 4 * f * (1 - f);
    // Shrinks from its scene size to exactly the landing spot's size.
    const scale = dot.value * (1 + (t.size / dotSize - 1) * f);
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
