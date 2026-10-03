import { useEffect } from "react";
import { Image } from "expo-image";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { colors } from "@/frontend/constants/theme";

// AnoUlam-logo confetti that pops out of the bottom-right corner: each
// logo is launched up and to the left, then arcs back down under gravity
// while spinning. A few greens at slightly different strengths, so the
// shades vary without inventing new colors.

const COUNT = 16;
// Logo size range (height); width follows the logo's 255x374 ratio.
const MIN_SIZE = 16;
const MAX_SIZE = 34;
const LOGO_RATIO = 255 / 374;
// Launch direction, in degrees from "right" counterclockwise: 100 is almost
// straight up, 130 leans left. Tuned so logos arc across the screen (apex
// ~250-450px up) instead of shooting straight off the left edge.
const MIN_ANGLE = 100;
const MAX_ANGLE = 130;
const MIN_SPEED = 900; // px/s
const MAX_SPEED = 1400;
const GRAVITY = 1500; // px/s²
const MIN_DURATION = 1600;
const MAX_DURATION = 2300;
const MAX_DELAY = 250;
// Where the burst comes from, in from the bottom-right corner.
const ORIGIN_INSET_X = 36;
const ORIGIN_INSET_Y = 90;

const SHADES = [colors.primary, colors.brandGreen.DEFAULT, colors.brandGreen.dark];

export type LogoPieceConfig = {
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

export function buildLogoPieces(screenWidth: number, screenHeight: number): LogoPieceConfig[] {
  return Array.from({ length: COUNT }, () => {
    const angle = ((MIN_ANGLE + Math.random() * (MAX_ANGLE - MIN_ANGLE)) * Math.PI) / 180;
    const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
    return {
      x0: screenWidth - ORIGIN_INSET_X,
      y0: screenHeight - ORIGIN_INSET_Y,
      vx: Math.cos(angle) * speed,
      // Screen y grows downward, so "up" is negative.
      vy: -Math.sin(angle) * speed,
      size: MIN_SIZE + Math.random() * (MAX_SIZE - MIN_SIZE),
      color: SHADES[Math.floor(Math.random() * SHADES.length)],
      opacity: 0.75 + Math.random() * 0.25,
      spin: (180 + Math.random() * 360) * (Math.random() < 0.5 ? -1 : 1),
      delay: Math.random() * MAX_DELAY,
      duration: MIN_DURATION + Math.random() * (MAX_DURATION - MIN_DURATION),
    };
  });
}

export function LogoConfettiPiece({ config }: { config: LogoPieceConfig }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(config.delay, withTiming(1, { duration: config.duration, easing: Easing.linear }));
    // Once, on mount.
  }, []);

  const style = useAnimatedStyle(() => {
    const t = (progress.value * config.duration) / 1000;
    const x = config.x0 + config.vx * t;
    const y = config.y0 + config.vy * t + 0.5 * GRAVITY * t * t;
    // Pop in quickly, fade out over the last fifth.
    const fadeIn = Math.min(1, progress.value * 10);
    const fadeOut = progress.value > 0.8 ? (1 - progress.value) / 0.2 : 1;
    return {
      opacity: config.opacity * fadeIn * fadeOut,
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${config.spin * progress.value}deg` }],
    };
  });

  return (
    <Animated.View style={[{ position: "absolute", top: 0, left: 0 }, style]}>
      <Image
        source={require("@/assets/icons/logo_white.png")}
        tintColor={config.color}
        style={{ width: config.size * LOGO_RATIO, height: config.size }}
        contentFit="contain"
      />
    </Animated.View>
  );
}
