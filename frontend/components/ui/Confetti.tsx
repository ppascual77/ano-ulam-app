import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { BoilingDoodle, DOODLE_COLORS, DOODLE_LIST, drawBoilPair, type DoodleVersion } from "./doodles";

const PARTICLE_COUNT = 16;
const DURATION_MS = 900;
// Extra downward drift by the end of the burst, so pieces arc and fall
// instead of flying out in straight lines.
const GRAVITY_PX = 60;
// How far pieces fly from the center: MIN + up to RANGE more. A wide range
// so some pieces land close and others fly far, instead of a neat ring.
const DISTANCE_MIN_PX = 50;
const DISTANCE_RANGE_PX = 80;
// Random +/- wobble on each piece's slot in the fan, in degrees.
const ANGLE_SCATTER_DEG = 20;
// Pieces leave over this window instead of all at once.
const DELAY_RANGE_MS = 140;

type Particle = {
  dx: number;
  dy: number;
  rotate: number;
  size: number;
  delay: number;
  color: string;
  versions: [DoodleVersion, DoodleVersion];
};

// Fan of angles (degrees; 0 = right, -90 = straight up) per direction.
// "upLeft": slightly down-left through up to up-right, for buttons near the
// right edge (a card's like/save, Discover's action rail) where bursting
// further right would get clipped or run off-screen. "up": symmetric around
// straight up, for buttons with room on both sides (or near the left edge).
const FANS = {
  upLeft: { from: -215, span: 175 },
  up: { from: -180, span: 180 },
} as const;

export type ConfettiDirection = keyof typeof FANS;

function makeParticles(direction: ConfettiDirection): Particle[] {
  const fan = FANS[direction];
  // Random starting shape per burst so neighbors differ between taps.
  const shapeOffset = Math.floor(Math.random() * DOODLE_LIST.length);
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const baseDeg = fan.from + (i / (PARTICLE_COUNT - 1)) * fan.span;
    const angle = ((baseDeg + (Math.random() - 0.5) * 2 * ANGLE_SCATTER_DEG) * Math.PI) / 180;
    const distance = DISTANCE_MIN_PX + Math.random() * DISTANCE_RANGE_PX;
    const doodle = DOODLE_LIST[(i + shapeOffset) % DOODLE_LIST.length];
    return {
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      rotate: (Math.random() - 0.5) * 360,
      size: 12 + Math.random() * 6,
      delay: Math.random() * DELAY_RANGE_MS,
      // Alternates per piece, and flips on the second lap through the doodles so
      // every shape shows up in both colors.
      color: DOODLE_COLORS[(i + Math.floor(i / DOODLE_LIST.length)) % DOODLE_COLORS.length],
      versions: drawBoilPair(doodle),
    };
  });
}

function ConfettiPiece({ dx, dy, rotate, size, delay, color, versions }: Particle) {
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
    <Animated.View style={[{ position: "absolute", left: -size / 2, top: -size / 2, width: size, height: size }, style]}>
      <BoilingDoodle versions={versions} size={size} color={color} />
    </Animated.View>
  );
}

type ConfettiProps = {
  /** Bump this to fire a new burst. 0 renders nothing. */
  burstId: number;
  /** Which way pieces fan out. Defaults to "upLeft". */
  direction?: ConfettiDirection;
};

// Burst of hand-drawn doodle confetti (the intro.gif's triangle, star,
// spiral, circle, zigzags and dots, in primary/accent) from the center of
// its parent. Render it as the first child of the button's wrapper so pieces
// start hidden behind the button and fly out from under it.
export function Confetti({ burstId, direction = "upLeft" }: ConfettiProps) {
  // New random spread per burst, so repeat taps don't look identical.
  const particles = useMemo(() => makeParticles(direction), [burstId, direction]);

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
