import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import type { LucideIcon } from "lucide-react-native";

const PARTICLE_COUNT = 12;
const DURATION_MS = 800;
// Extra downward drift by the end of the burst, so pieces arc and fall
// instead of flying out in straight lines.
const GRAVITY_PX = 48;
// How far pieces fly from the center: MIN + up to RANGE more.
const DISTANCE_MIN_PX = 45;
const DISTANCE_RANGE_PX = 40;

type Particle = {
  dx: number;
  dy: number;
  rotate: number;
  size: number;
  delay: number;
};

function makeParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    // Fan from slightly down-left, through straight up, to up-right. Every
    // current trigger (a card's like/save, Discover's action rail) sits
    // near the right edge, so bursting further right would just get
    // clipped or run off-screen.
    const baseDeg = -200 + (i / (PARTICLE_COUNT - 1)) * 150;
    const angle = ((baseDeg + (Math.random() - 0.5) * 15) * Math.PI) / 180;
    const distance = DISTANCE_MIN_PX + Math.random() * DISTANCE_RANGE_PX;
    return {
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      rotate: (Math.random() - 0.5) * 360,
      size: 10 + Math.random() * 6,
      delay: Math.random() * 60,
    };
  });
}

function ConfettiPiece({ dx, dy, rotate, size, delay, icon: Icon, color }: Particle & { icon: LucideIcon; color: string }) {
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
      <Icon color={color} fill={color} size={size} />
    </Animated.View>
  );
}

type ConfettiProps = {
  /** Bump this to fire a new burst. 0 renders nothing. */
  burstId: number;
  /** The piece shape, e.g. Heart for a like, Bookmark for a save. */
  icon: LucideIcon;
  color: string;
};

// Burst of icon-shaped confetti from the center of its parent. Render it as
// the first child of the button's wrapper so pieces start hidden behind the
// button and fly out from under it.
export function Confetti({ burstId, icon, color }: ConfettiProps) {
  // New random spread per burst, so repeat taps don't look identical.
  const particles = useMemo(makeParticles, [burstId]);

  if (burstId === 0) return null;

  return (
    <View style={{ pointerEvents: "none" }} className="absolute left-1/2 top-1/2">
      {particles.map((particle, i) => (
        // burstId in the key remounts every piece, restarting its animation.
        <ConfettiPiece key={`${burstId}-${i}`} {...particle} icon={icon} color={color} />
      ))}
    </View>
  );
}

// Burst id that bumps whenever `active` goes false -> true (a like or save
// landing), but not on mount. Remount the owner (e.g. key it by item) when
// switching items, so moving to an already-liked item doesn't fire.
export function useBurstOnActivate(active: boolean) {
  const [burstId, setBurstId] = useState(0);
  const previous = useRef(active);
  useEffect(() => {
    if (active && !previous.current) setBurstId((id) => id + 1);
    previous.current = active;
  }, [active]);
  return burstId;
}
