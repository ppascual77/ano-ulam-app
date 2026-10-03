import { useEffect } from "react";
import { Image } from "expo-image";
import { Heart } from "lucide-react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { colors } from "@/frontend/constants/theme";

// Confetti that pops out of a bottom corner: each piece is launched up and
// toward the middle, arcs over, and falls back down off the bottom of the
// screen, spinning. Bottom-right pops AnoUlam logos (a few greens at
// slightly different strengths); bottom-left pops hearts (the app's warm
// reds/orange). No new colors, just existing tokens.

export type PopKind = "logo" | "heart";
type Side = "right" | "left";

const COUNT = 16;
// Piece size range (height); a logo's width follows its 255x374 ratio.
const MIN_SIZE = 16;
const MAX_SIZE = 34;
const LOGO_RATIO = 255 / 374;
// Launch direction, in degrees from straight up toward the middle of the
// screen: 10 is almost vertical, 40 leans in. Mirrored per side.
const MIN_LEAN = 10;
const MAX_LEAN = 40;
// Slow and floaty: modest launch speed, light gravity.
const MIN_SPEED = 700; // px/s
const MAX_SPEED = 1050;
const GRAVITY = 900; // px/s²
const MAX_DELAY = 250;
// Where the burst comes from, in from the bottom corner.
const ORIGIN_INSET_X = 36;
const ORIGIN_INSET_Y = 90;
// Pieces keep falling until this far past the bottom edge.
const EXIT_BELOW = 40;

const SHADES: Record<PopKind, string[]> = {
  logo: [colors.primary, colors.brandGreen.DEFAULT, colors.brandGreen.dark],
  heart: [colors.like, colors.accent, colors.macro.fats],
};

export type PopPieceConfig = {
  kind: PopKind;
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  opacity: number;
  spin: number;
  delay: number;
  duration: number;
};

// The longest a piece can take (delay + flight), for the caller's cleanup
// timer.
export const POP_MAX_LIFETIME_MS = (() => {
  const vy = MAX_SPEED;
  const drop = ORIGIN_INSET_Y + EXIT_BELOW;
  return Math.ceil(((vy + Math.sqrt(vy * vy + 2 * GRAVITY * drop)) / GRAVITY) * 1000) + MAX_DELAY;
})();

function buildPop(kind: PopKind, side: Side, screenWidth: number, screenHeight: number): PopPieceConfig[] {
  const towardMiddle = side === "right" ? -1 : 1;
  return Array.from({ length: COUNT }, () => {
    const lean = ((MIN_LEAN + Math.random() * (MAX_LEAN - MIN_LEAN)) * Math.PI) / 180;
    const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
    // Screen y grows downward, so "up" is negative.
    const vx = Math.sin(lean) * speed * towardMiddle;
    const vy = -Math.cos(lean) * speed;
    const y0 = screenHeight - ORIGIN_INSET_Y;
    // Time until it falls past the bottom: solve y0 + vy t + g t²/2 = bottom.
    const drop = screenHeight + EXIT_BELOW - y0;
    const flight = (-vy + Math.sqrt(vy * vy + 2 * GRAVITY * drop)) / GRAVITY;
    return {
      kind,
      x0: side === "right" ? screenWidth - ORIGIN_INSET_X : ORIGIN_INSET_X,
      y0,
      vx,
      vy,
      size: MIN_SIZE + Math.random() * (MAX_SIZE - MIN_SIZE),
      color: SHADES[kind][Math.floor(Math.random() * SHADES[kind].length)],
      opacity: 0.75 + Math.random() * 0.25,
      spin: (180 + Math.random() * 360) * (Math.random() < 0.5 ? -1 : 1),
      delay: Math.random() * MAX_DELAY,
      duration: flight * 1000,
    };
  });
}

// Logos from the bottom-right plus hearts from the bottom-left.
export function buildCornerPops(screenWidth: number, screenHeight: number): PopPieceConfig[] {
  return [...buildPop("logo", "right", screenWidth, screenHeight), ...buildPop("heart", "left", screenWidth, screenHeight)];
}

export function PopConfettiPiece({ config }: { config: PopPieceConfig }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(config.delay, withTiming(1, { duration: config.duration, easing: Easing.linear }));
    // Once, on mount.
  }, []);

  const style = useAnimatedStyle(() => {
    const t = (progress.value * config.duration) / 1000;
    const x = config.x0 + config.vx * t;
    const y = config.y0 + config.vy * t + 0.5 * GRAVITY * t * t;
    // Pops in quickly; falls out of view at the bottom, no mid-air fade.
    const fadeIn = Math.min(1, progress.value * 10);
    return {
      opacity: config.opacity * fadeIn,
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${config.spin * progress.value}deg` }],
    };
  });

  return (
    <Animated.View style={[{ position: "absolute", top: 0, left: 0 }, style]}>
      {config.kind === "logo" ? (
        <Image
          source={require("@/assets/icons/logo_white.png")}
          tintColor={config.color}
          style={{ width: config.size * LOGO_RATIO, height: config.size }}
          contentFit="contain"
        />
      ) : (
        <Heart color={config.color} fill={config.color} size={config.size} />
      )}
    </Animated.View>
  );
}
