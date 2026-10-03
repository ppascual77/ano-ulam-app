import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { Bookmark } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

const PARTICLE_COUNT = 10;
const DURATION_MS = 750;
// Extra downward drift by the end of the burst, so pieces arc and fall
// instead of flying out in straight lines.
const GRAVITY_PX = 40;

type Particle = {
  dx: number;
  dy: number;
  rotate: number;
  size: number;
  delay: number;
};

function makeParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    // Fan from slightly down-left, through straight up, to up-right. The
    // bookmark sits near the card's right edge, so bursting further right
    // would just get clipped by the card's overflow-hidden.
    const baseDeg = -200 + (i / (PARTICLE_COUNT - 1)) * 150;
    const angle = ((baseDeg + (Math.random() - 0.5) * 15) * Math.PI) / 180;
    const distance = 35 + Math.random() * 30;
    return {
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      rotate: (Math.random() - 0.5) * 360,
      size: 10 + Math.random() * 6,
      delay: Math.random() * 60,
    };
  });
}

function ConfettiPiece({ dx, dy, rotate, size, delay }: Particle) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: DURATION_MS, easing: Easing.out(Easing.cubic) }),
    );
  }, [progress, delay]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4,
      transform: [
        { translateX: dx * p },
        { translateY: dy * p + GRAVITY_PX * p * p },
        { rotate: `${rotate * p}deg` },
        { scale: 0.4 + 0.6 * Math.min(p * 3, 1) },
      ],
    };
  });

  return (
    <Animated.View style={[{ position: "absolute", left: -size / 2, top: -size / 2 }, style]}>
      <Bookmark color={colors.primary} fill={colors.primary} size={size} />
    </Animated.View>
  );
}

type BookmarkConfettiProps = {
  /** Bump this to fire a new burst. 0 renders nothing. */
  burstId: number;
};

// Burst of bookmark-shaped confetti from the center of its parent. Render it
// as the first child of the bookmark button's wrapper so pieces start hidden
// behind the button and fly out from under it.
export function BookmarkConfetti({ burstId }: BookmarkConfettiProps) {
  // New random spread per burst, so repeat saves don't look identical.
  const particles = useMemo(makeParticles, [burstId]);

  if (burstId === 0) return null;

  return (
    <View style={{ pointerEvents: "none" }} className="absolute left-1/2 top-1/2">
      {particles.map((particle, i) => (
        // burstId in the key remounts every piece, restarting its animation.
        <ConfettiPiece key={`${burstId}-${i}`} {...particle} />
      ))}
    </View>
  );
}
