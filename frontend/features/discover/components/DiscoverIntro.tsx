import { type ReactNode, type RefObject, useEffect, useState } from "react";
import { StyleSheet, Text, View, type ViewInstance } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { ChefHat, Heart, MapPin } from "lucide-react-native";
import { BoilingDoodle, DOODLE_LIST, INTRO_DOT_REST_MS, PageIntro, drawBoilPair, type IntroSize } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

// A quick glance at Discover, on black: kwentuhan, a group chat about food,
// since Discover is for sharing anything food (what you ate, your recipes,
// food finds, reactions).
//   0.0s   "What's everyone eating?" rises in
//   0.25s  cooks chime in one by one, alternating sides, each bubble a
//          different kind of share: a meal photo, a recipe, a food find,
//          then a doodle sticker; hearts land on the first three
//   2.15s  your own bubble pops in, empty, a cursor and an orange "+"
//          blinking in it
//   2.6s   "Your turn." fades in; "Share it." slams in, in orange
//   3.7s   everything shrinks into the "+", which becomes the dot, settles,
//          then arcs up into the Create (+) button (see PageIntro); the +
//          takes it in with a pulse and an orange flush, then its border
//          runs one lap (CreateButton)
const ROWS_AT = 250;
const ROW_STAGGER_MS = 420;
// After its avatar, a bubble pops; after the bubble, its heart.
const BUBBLE_AFTER_MS = 120;
const HEART_AFTER_MS = 420;
const YOURS_AT = 2150;
const BLINK_AT = 2400;
const TURN_AT = 2600;
const SHARE_AT = 2950;
const COLLAPSE_AT = 3700;
const COLLAPSE_MS = 380;
const DOT_AT = COLLAPSE_AT + 60;
const FLY_AT = DOT_AT + INTRO_DOT_REST_MS;

// Rows, from CHAT_TOP of the screen's height down.
const CHAT_TOP = 0.2;
const ROW_H = 78;
const SIDE = 20;
const AVATAR = 36;
const BUBBLE_INSET = SIDE + AVATAR + 10;
// Your bubble, and the "+" in its middle (drawn from two bars so its
// middle can be the dot).
const YOURS_W = 128;
const YOURS_H = 52;
const PLUS = 24;
const PLUS_BAR = 5;

type Side = "left" | "right";
const ROWS: { side: Side; initial: string; reacted: boolean }[] = [
  { side: "left", initial: "J", reacted: true },
  { side: "right", initial: "M", reacted: true },
  { side: "left", initial: "A", reacted: true },
  { side: "right", initial: "R", reacted: false },
];

const POP_SPRING = { damping: 8, stiffness: 220, mass: 0.5 };
const SLAM_SPRING = { damping: 11, stiffness: 320, mass: 0.6 };

const rowTop = (size: IntroSize, i: number) => size.h * CHAT_TOP + i * ROW_H;
// The "+" in your bubble: where the dot takes off.
const plusCenter = (size: IntroSize) => ({
  x: size.w - BUBBLE_INSET - YOURS_W / 2,
  y: rowTop(size, ROWS.length) + 10 + YOURS_H / 2,
});

function usePop(at: number) {
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = withDelay(at, withSpring(1, POP_SPRING));
  }, [pop, at]);
  return pop;
}

function Avatar({ initial, side, top, at, you = false }: { initial: string; side: Side; top: number; at: number; you?: boolean }) {
  const pop = usePop(at);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 2), transform: [{ scale: pop.value }] }));
  return (
    <Animated.View
      style={[{ position: "absolute", top, [side]: SIDE, width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 }, style]}
      className={`items-center justify-center border-2 ${you ? "border-accent bg-accent/20" : "border-white/80 bg-white/15"}`}
    >
      <Text className="font-inter-bold text-small text-white">{initial}</Text>
    </Animated.View>
  );
}

// A chat bubble, popping out from its avatar's side.
function Bubble({ side, top, at, children, bare = false }: { side: Side; top: number; at: number; children: ReactNode; bare?: boolean }) {
  const pop = usePop(at);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 2),
    transform: [{ translateY: 12 * (1 - pop.value) }, { scale: 0.85 + 0.15 * pop.value }],
  }));
  return (
    <Animated.View
      style={[{ position: "absolute", top, [side]: BUBBLE_INSET, maxWidth: 230, transformOrigin: side === "left" ? "left" : "right" }, style]}
      className={bare ? "" : `rounded-2xl bg-white/10 px-3 py-2.5 ${side === "left" ? "rounded-tl-sm" : "rounded-tr-sm"}`}
    >
      {children}
    </Animated.View>
  );
}

// A heart reaction landing on a bubble's corner.
function Reaction({ side, top, at }: { side: Side; top: number; at: number }) {
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = withDelay(at, withSequence(withSpring(1.3, { damping: 6, stiffness: 300 }), withSpring(1)));
  }, [pop, at]);
  const style = useAnimatedStyle(() => ({ opacity: pop.value > 0 ? 1 : 0, transform: [{ scale: pop.value }] }));
  return (
    <Animated.View
      style={[{ position: "absolute", top: top + 40, [side]: BUBBLE_INSET - 8, width: 22, height: 22, borderRadius: 11 }, style]}
      className="items-center justify-center bg-like"
    >
      <Heart color={colors.white} fill={colors.white} size={12} />
    </Animated.View>
  );
}

// The sticker: one of the app's hand-drawn doodles, boiling and turning.
function Sticker() {
  const [versions] = useState(() => drawBoilPair(DOODLE_LIST[1]));
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1);
  }, [spin]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  return (
    <Animated.View style={style}>
      <BoilingDoodle versions={versions} size={56} color={colors.accent} />
    </Animated.View>
  );
}

function ChatScene({ size }: { size: IntroSize }) {
  const plus = plusCenter(size);
  const yoursTop = rowTop(size, ROWS.length) + 10;
  const blink = useSharedValue(1);
  const turn = useSharedValue(0);
  const slam = useSharedValue(0);
  const collapse = useSharedValue(0);

  useEffect(() => {
    blink.value = withDelay(BLINK_AT, withRepeat(withSequence(withTiming(0.2, { duration: 220 }), withTiming(1, { duration: 220 })), 3));
    turn.value = withDelay(TURN_AT, withTiming(1, { duration: 400 }));
    slam.value = withDelay(SHARE_AT, withSpring(1, SLAM_SPRING));
    collapse.value = withDelay(COLLAPSE_AT, withTiming(1, { duration: COLLAPSE_MS, easing: Easing.in(Easing.cubic) }));
  }, []);

  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.value }));
  const turnStyle = useAnimatedStyle(() => ({ opacity: turn.value, transform: [{ translateY: 10 * (1 - turn.value) }] }));
  const slamStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, slam.value * 3), transform: [{ scale: 1.8 - 0.8 * slam.value }] }));
  // Everything shrinks into the "+" (where PageIntro's dot takes over).
  const collapseStyle = useAnimatedStyle(() => ({ opacity: 1 - collapse.value, transform: [{ scale: 1 - 0.85 * collapse.value }] }));

  // Each row's content: a different kind of share.
  const shares: ReactNode[] = [
    <View key="meal" className="flex-row items-center gap-2.5">
      <Text className="font-inter-semibold text-body text-white">Ulam ko today!</Text>
      <View className="h-10 w-10 rounded-lg bg-primary" />
    </View>,
    <View key="recipe">
      <View className="flex-row items-center gap-1.5">
        <ChefHat color={colors.white} size={15} />
        <Text className="font-inter-semibold text-body text-white">Try my sinigang</Text>
      </View>
      <Text className="mt-0.5 font-inter-regular text-small text-white/60">4 steps · ₱180</Text>
    </View>,
    <View key="find">
      <View className="flex-row items-center gap-1.5">
        <MapPin color={colors.accent} size={15} />
        <Text className="font-inter-semibold text-body text-white">Sulit dito!</Text>
      </View>
      <Text className="mt-0.5 font-inter-regular text-small text-white/60">₱99 tapsilog, unli rice</Text>
    </View>,
    <Sticker key="sticker" />,
  ];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: [plus.x, plus.y, 0] }, collapseStyle]}>
      <Animated.View entering={FadeInDown.duration(450)} className="items-center" style={{ marginTop: size.h * 0.1 }}>
        <Text className="font-inter-medium text-subheading text-white/70">What&apos;s everyone eating?</Text>
      </Animated.View>

      {ROWS.map((row, i) => {
        const at = ROWS_AT + i * ROW_STAGGER_MS;
        const top = rowTop(size, i);
        return (
          <View key={i} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Avatar initial={row.initial} side={row.side} top={top} at={at} />
            <Bubble side={row.side} top={top} at={at + BUBBLE_AFTER_MS} bare={i === ROWS.length - 1}>
              {shares[i]}
            </Bubble>
            {row.reacted && <Reaction side={row.side} top={top} at={at + HEART_AFTER_MS} />}
          </View>
        );
      })}

      {/* Your bubble: empty, a cursor and the "+" blinking. */}
      <Avatar initial="You" side="right" top={yoursTop + (YOURS_H - AVATAR) / 2} at={YOURS_AT} you />
      <Bubble side="right" top={yoursTop} at={YOURS_AT + BUBBLE_AFTER_MS} bare>
        <View
          style={{ width: YOURS_W, height: YOURS_H }}
          className="items-center justify-center rounded-2xl rounded-tr-sm border-2 border-accent bg-black"
        >
          <Animated.View style={[{ position: "absolute", left: 14, width: 2, height: 22 }, blinkStyle]} className="bg-white" />
          <Animated.View style={[{ width: PLUS, height: PLUS }, blinkStyle]} className="items-center justify-center">
            <View className="absolute bg-accent" style={{ width: PLUS, height: PLUS_BAR, borderRadius: PLUS_BAR / 2 }} />
            <View className="absolute bg-accent" style={{ width: PLUS_BAR, height: PLUS, borderRadius: PLUS_BAR / 2 }} />
          </Animated.View>
        </View>
      </Bubble>

      <View style={{ position: "absolute", left: 0, right: 0, top: yoursTop + YOURS_H + 36 }} className="items-center">
        <Animated.View style={turnStyle}>
          <Text className="font-inter-extrabold text-heading-lg tracking-display text-white">
            Your turn<Text className="text-accent">.</Text>
          </Text>
        </Animated.View>
        <Animated.View style={slamStyle} className="mt-1">
          <Text className="font-inter-extrabold text-subhero tracking-display text-accent">Share it.</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

type DiscoverIntroProps = {
  active: boolean;
  /** The Create button's landing spot (see CreateButton's landingRef). */
  targetRef: RefObject<ViewInstance | null>;
  onDone: () => void;
};

export function DiscoverIntro({ active, targetRef, onDone }: DiscoverIntroProps) {
  return (
    <PageIntro
      active={active}
      targetRef={targetRef}
      onDone={onDone}
      // Takes off from the "+" in your empty bubble.
      dotStart={plusCenter}
      dotAt={DOT_AT}
      flyAt={FLY_AT}
      dotSize={PLUS_BAR * 2}
      tone="dark"
      accessibilityLabel="Discover: share anything food, what you ate, your recipes, your sulit finds, and react to everyone else's. Share yours with the Create button."
    >
      {(size) => <ChatScene size={size} />}
    </PageIntro>
  );
}
