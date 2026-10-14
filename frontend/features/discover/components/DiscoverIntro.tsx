import { type RefObject, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Heart } from "lucide-react-native";
import { INTRO_DOT_REST_MS, PageIntro, type IntroSize } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

// A quick glance at Discover, on black like its reel: a community posting.
//   0.0s   "Hungry for ideas?" rises in
//   0.25s  cooks pop in around the screen (avatar dots)
//   0.7s   each posts a dish card that flies to the middle and lands on a
//          pile, slightly askew
//   1.1s   hearts float up off the pile
//   2.4s   an empty card lands on top, its "+" blinking
//   2.7s   "Your turn." fades in; "Share it." slams in, in orange
//   3.8s   everything shrinks into the "+", which becomes the dot, settles,
//          then arcs up into the Create (+) button (see PageIntro); the +
//          takes it in with a pulse and an orange flush, then its border
//          runs one lap (CreateButton)
const AVATARS_AT = 250;
const AVATAR_STAGGER_MS = 90;
const CARDS_AT = 700;
const CARD_STAGGER_MS = 260;
const CARD_MS = 480;
const HEARTS_AT = 1100;
const HEART_STAGGER_MS = 250;
const EMPTY_AT = 2400;
const BLINK_AT = 2600;
const TURN_AT = 2700;
const SHARE_AT = 3100;
const COLLAPSE_AT = 3800;
const COLLAPSE_MS = 380;
const DOT_AT = COLLAPSE_AT + 60;
const FLY_AT = DOT_AT + INTRO_DOT_REST_MS;

// Where the pile sits (fraction of the screen's height) and its cards' size.
const PILE_Y = 0.46;
const CARD_W = 116;
const CARD_H = 146;
const PHOTO_H = 96;

// Each cook: where they pop in (screen fractions), their photo color, the
// dish they post, and how their card lands on the pile.
const POSTS = [
  { at: { x: 0.16, y: 0.27 }, initial: "J", color: "bg-primary", dish: "Sisig", tilt: -9, dx: -10, dy: 6 },
  { at: { x: 0.84, y: 0.25 }, initial: "M", color: "bg-accent", dish: "Laing", tilt: 7, dx: 12, dy: -4 },
  { at: { x: 0.12, y: 0.66 }, initial: "A", color: "bg-like", dish: "Bulalo", tilt: -4, dx: -6, dy: -8 },
  { at: { x: 0.88, y: 0.68 }, initial: "R", color: "bg-brand-green", dish: "Tinola", tilt: 10, dx: 8, dy: 10 },
  { at: { x: 0.5, y: 0.2 }, initial: "K", color: "bg-accent", dish: "Kare-Kare", tilt: -2, dx: 0, dy: 0 },
];
const HEART_XS = [-48, 40, -20, 56];

// "+" drawn from two bars, so its middle can be the dot. Sized to fit a card.
const PLUS = 28;
const PLUS_BAR = 6;

const POP_SPRING = { damping: 8, stiffness: 220, mass: 0.5 };
const SLAM_SPRING = { damping: 11, stiffness: 320, mass: 0.6 };

const pileCenter = (size: IntroSize) => ({ x: size.w / 2, y: size.h * PILE_Y });

function Avatar({ x, y, initial, index }: { x: number; y: number; initial: string; index: number }) {
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = withDelay(AVATARS_AT + index * AVATAR_STAGGER_MS, withSpring(1, POP_SPRING));
  }, [pop, index]);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 2), transform: [{ scale: pop.value }] }));
  return (
    <Animated.View
      style={[{ position: "absolute", left: x - 20, top: y - 20, width: 40, height: 40, borderRadius: 20 }, style]}
      className="items-center justify-center border-2 border-white/80 bg-white/15"
    >
      <Text className="font-inter-bold text-body text-white">{initial}</Text>
    </Animated.View>
  );
}

// A posted dish: starts tiny at its cook, flies to the pile and lands askew.
function PostCard({ post, index, size }: { post: (typeof POSTS)[number]; index: number; size: IntroSize }) {
  const fly = useSharedValue(0);
  const from = { x: post.at.x * size.w, y: post.at.y * size.h };
  const to = pileCenter(size);
  useEffect(() => {
    fly.value = withDelay(CARDS_AT + index * CARD_STAGGER_MS, withTiming(1, { duration: CARD_MS, easing: Easing.out(Easing.back(1.4)) }));
  }, [fly, index]);
  const style = useAnimatedStyle(() => {
    const f = fly.value;
    return {
      opacity: f > 0 ? 1 : 0,
      transform: [
        { translateX: from.x + (to.x + post.dx - from.x) * f - CARD_W / 2 },
        { translateY: from.y + (to.y + post.dy - from.y) * f - CARD_H / 2 },
        { scale: interpolate(f, [0, 1], [0.25, 1]) },
        { rotate: `${post.tilt * f}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[{ position: "absolute", left: 0, top: 0, width: CARD_W, height: CARD_H }, style]}
      className="overflow-hidden rounded-2xl bg-white"
    >
      <View className={post.color} style={{ height: PHOTO_H }} />
      <View className="flex-1 justify-center px-3">
        <Text numberOfLines={1} className="font-inter-bold text-body text-ink-emphasis">
          {post.dish}
        </Text>
        <View className="mt-1 flex-row items-center gap-1">
          <Heart color={colors.like} fill={colors.like} size={11} />
          <Text className="font-inter-medium text-small text-ink-subtle">{24 + index * 13}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// A heart floating up off the pile.
function FloatingHeart({ x, index, size }: { x: number; index: number; size: IntroSize }) {
  const rise = useSharedValue(0);
  const c = pileCenter(size);
  useEffect(() => {
    rise.value = withDelay(HEARTS_AT + index * HEART_STAGGER_MS, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
  }, [rise, index]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(rise.value, [0, 0.15, 0.7, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: c.x + x - 12 + 8 * Math.sin(rise.value * Math.PI * 2) },
      { translateY: c.y - CARD_H / 2 - 90 * rise.value },
      { scale: 0.6 + 0.6 * rise.value },
    ],
  }));
  return (
    <Animated.View style={[{ position: "absolute", left: 0, top: 0 }, style]}>
      <Heart color={colors.like} fill={colors.like} size={24} />
    </Animated.View>
  );
}

function FeedScene({ size }: { size: IntroSize }) {
  const c = pileCenter(size);
  const empty = useSharedValue(0);
  const blink = useSharedValue(1);
  const turn = useSharedValue(0);
  const slam = useSharedValue(0);
  const collapse = useSharedValue(0);

  useEffect(() => {
    empty.value = withDelay(EMPTY_AT, withSpring(1, POP_SPRING));
    blink.value = withDelay(BLINK_AT, withRepeat(withSequence(withTiming(0.25, { duration: 220 }), withTiming(1, { duration: 220 })), 3));
    turn.value = withDelay(TURN_AT, withTiming(1, { duration: 400 }));
    slam.value = withDelay(SHARE_AT, withSpring(1, SLAM_SPRING));
    collapse.value = withDelay(COLLAPSE_AT, withTiming(1, { duration: COLLAPSE_MS, easing: Easing.in(Easing.cubic) }));
  }, []);

  const emptyStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, empty.value * 2),
    transform: [{ translateY: -30 * (1 - empty.value) }, { scale: 0.8 + 0.2 * empty.value }],
  }));
  const plusStyle = useAnimatedStyle(() => ({ opacity: blink.value }));
  const turnStyle = useAnimatedStyle(() => ({ opacity: turn.value, transform: [{ translateY: 10 * (1 - turn.value) }] }));
  const slamStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, slam.value * 3), transform: [{ scale: 1.8 - 0.8 * slam.value }] }));
  // Everything shrinks into the "+" (where PageIntro's dot takes over).
  const collapseStyle = useAnimatedStyle(() => ({ opacity: 1 - collapse.value, transform: [{ scale: 1 - 0.85 * collapse.value }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: [c.x, c.y, 0] }, collapseStyle]}>
      <Animated.View entering={FadeInDown.duration(450)} className="items-center" style={{ marginTop: size.h * 0.1 }}>
        <Text className="font-inter-medium text-subheading text-white/70">Hungry for ideas?</Text>
      </Animated.View>

      {POSTS.map((post, i) => (
        <Avatar key={post.initial + i} x={post.at.x * size.w} y={post.at.y * size.h} initial={post.initial} index={i} />
      ))}
      {POSTS.map((post, i) => (
        <PostCard key={post.dish} post={post} index={i} size={size} />
      ))}
      {HEART_XS.map((x, i) => (
        <FloatingHeart key={i} x={x} index={i} size={size} />
      ))}

      {/* Your card: empty, dashed, with a blinking "+". */}
      <Animated.View
        style={[
          { position: "absolute", left: c.x - CARD_W / 2, top: c.y - CARD_H / 2, width: CARD_W, height: CARD_H, borderStyle: "dashed" },
          emptyStyle,
        ]}
        className="items-center justify-center rounded-2xl border-2 border-white/60 bg-black"
      >
        <Animated.View style={[{ width: PLUS, height: PLUS }, plusStyle]} className="items-center justify-center">
          <View className="absolute bg-accent" style={{ width: PLUS, height: PLUS_BAR, borderRadius: PLUS_BAR / 2 }} />
          <View className="absolute bg-accent" style={{ width: PLUS_BAR, height: PLUS, borderRadius: PLUS_BAR / 2 }} />
        </Animated.View>
      </Animated.View>

      <View style={{ position: "absolute", left: 0, right: 0, top: c.y + CARD_H / 2 + 36 }} className="items-center">
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
  targetRef: RefObject<View | null>;
  onDone: () => void;
};

export function DiscoverIntro({ active, targetRef, onDone }: DiscoverIntroProps) {
  return (
    <PageIntro
      active={active}
      targetRef={targetRef}
      onDone={onDone}
      // Takes off from the "+" in the middle of your empty card.
      dotStart={pileCenter}
      dotAt={DOT_AT}
      flyAt={FLY_AT}
      dotSize={PLUS_BAR * 2}
      tone="dark"
      accessibilityLabel="Discover: see what other cooks are posting, like and save the ones you want, and share your own with the Create button."
    >
      {(size) => <FeedScene size={size} />}
    </PageIntro>
  );
}
