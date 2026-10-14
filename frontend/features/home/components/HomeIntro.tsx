import { type RefObject, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import {
  BoilingDoodle,
  DOODLE_COLORS,
  DOODLE_LIST,
  HOP_MARKER_SIZE,
  INTRO_DOT_REST_MS,
  PageIntro,
  drawBoilPair,
  type IntroSize,
} from "@/frontend/components/ui";

// The welcome right after onboarding. Onboarding's page indicator dot comes
// along (see OnboardingScreen) and what you just picked goes into the pot:
//   0.0s   the indicator's pill squeezes into a ball and hops up to become
//          the dot of "Hey, welcome!"'s "!"
//   0.5s   it lands and the greeting waves (tilts back and forth twice)
//   0.9s   an outlined kaldero rises in under it
//   1.3s   your onboarding picks ("Save money", "No nuts", ...) pop in from
//          the sides one by one and drop into the pot, which bumps each time
//          while a hand-drawn doodle (swirl, star, triangle, circle: the
//          app's doodle set, boiling like the confetti) pops up in its own
//          spot inside it; they all keep spinning until the end
//   then   the pot rattles, the lid pops with a puff of steam, and "Your
//          ulam, sorted." rises out; "Tara, kain!" (handwritten) pops in
//   ~4.3s  everything collapses into the "!"'s dot, which settles, then
//          arcs up and lands as the period of "Categories." (see
//          PageIntro), where HomeScreen bursts confetti
// The picks drive the timing (up to MAX_PICKS), so it's computed per run.
const ENTRY_MS = 500;
const ENTRY_ARC = 140;
const WAVE_STEP_MS = 110;
const POT_AT = 900;
const PICKS_AT = 1300;
const PICK_STAGGER_MS = 300;
// Pops in at the side, then flies into the pot.
const PICK_APPEAR_MS = 220;
const PICK_FLY_MS = 520;
const PICK_ARC = 70;
const RATTLE_STEP_MS = 70;
const COLLAPSE_MS = 380;

const MAX_PICKS = 4;
// When onboarding sent nothing (skipped the questions, or a replay).
const FALLBACK_PICKS = ["Save money", "Eat more protein", "Pinoy favorites"];

function timeline(pickCount: number) {
  const picksDone = PICKS_AT + (pickCount - 1) * PICK_STAGGER_MS + PICK_APPEAR_MS + PICK_FLY_MS;
  const rattleAt = picksDone + 80;
  const lidAt = rattleAt + RATTLE_STEP_MS * 5;
  const sortedAt = lidAt + 120;
  const noteAt = sortedAt + 500;
  const collapseAt = noteAt + 600;
  const dotAt = collapseAt + 60;
  return { rattleAt, lidAt, sortedAt, noteAt, collapseAt, dotAt, flyAt: dotAt + INTRO_DOT_REST_MS };
}

// The "!" is drawn (stem + dot) instead of typed, so its dot can be the one
// that flies in. Sized for text-subhero (55px extrabold).
const BANG_STEM_W = 9;
const BANG_STEM_H = 27;
const BANG_GAP = 5;
const BANG_DOT = 10;
// Lifts the "!" onto the text's baseline.
const BANG_BASELINE = 10;

// The kaldero, an outline drawn from bordered shapes. Its mouth (top of the
// body) sits at POT_MOUTH of the screen's height.
const POT_MOUTH = 0.56;
const POT_W = 150;
const POT_H = 84;
const RIM_W = 172;
const RIM_H = 12;
const LID_W = 146;
const LID_H = 28;
const POT_STROKE = 3;

// One doodle spins up in the pot per pick, in this order (indexes into
// DOODLE_LIST: spiral, star, triangle, circle), alternating green/orange,
// each in its own spot (offsets from the body's middle) so they fill the pot.
const POT_DOODLES = [2, 1, 0, 3];
const POT_DOODLE_SPOTS = [
  { x: -36, y: -8 },
  { x: 34, y: 6 },
  { x: -4, y: 16 },
  { x: 40, y: -16 },
];
const POT_DOODLE_SIZE = 34;
// Every doodle turns at this same steady speed from its pop to the end.
const DOODLE_TURN_MS = 1200;

const POP_SPRING = { damping: 8, stiffness: 220, mass: 0.5 };
const LID_SPRING = { damping: 7, stiffness: 260, mass: 0.6 };
const ENTRY_SIZE = HOP_MARKER_SIZE.pill;

type Point = { x: number; y: number };

const center = (size: IntroSize) => ({ x: size.w / 2, y: size.h / 2 });

// One pick: pops in at one side above the pot, then arcs into its mouth,
// shrinking and fading as it goes in.
function PickChip({ label, index, size, mouthY }: { label: string; index: number; size: IntroSize; mouthY: number }) {
  const appear = useSharedValue(0);
  const fly = useSharedValue(0);
  const side = index % 2 === 0 ? -1 : 1;
  const startX = side * size.w * 0.26;
  const startY = mouthY - 170 + (index % 3) * 34;

  useEffect(() => {
    const at = PICKS_AT + index * PICK_STAGGER_MS;
    appear.value = withDelay(at, withSpring(1, POP_SPRING));
    fly.value = withDelay(at + PICK_APPEAR_MS, withTiming(1, { duration: PICK_FLY_MS, easing: Easing.in(Easing.quad) }));
  }, [appear, fly, index]);

  const style = useAnimatedStyle(() => {
    const f = fly.value;
    return {
      opacity: Math.min(1, appear.value * 2) * interpolate(f, [0, 0.75, 1], [1, 1, 0]),
      transform: [
        { translateX: startX * (1 - f) },
        { translateY: startY + (mouthY - 18 - startY) * f - PICK_ARC * 4 * f * (1 - f) },
        { scale: appear.value * (1 - 0.55 * f) },
        { rotate: `${side * -6 * (1 - f)}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: 0, alignItems: "center" }, style]}>
      <View className="rounded-full border border-ink-emphasis/10 bg-mood-bg px-3 py-2">
        <Text className="font-inter-semibold text-small text-ink-emphasis">{label}</Text>
      </View>
    </Animated.View>
  );
}

// A doodle popping up inside the pot as a pick drops in. Every one stays,
// in its own spot, turning at the same speed until the scene collapses.
function PotDoodle({ index, at, until }: { index: number; at: number; until: number }) {
  const [versions] = useState(() => drawBoilPair(DOODLE_LIST[POT_DOODLES[index % POT_DOODLES.length]]));
  const spot = POT_DOODLE_SPOTS[index % POT_DOODLE_SPOTS.length];
  const pop = useSharedValue(0);
  const spin = useSharedValue(0);
  useEffect(() => {
    pop.value = withDelay(at, withSpring(1, POP_SPRING));
    const turning = Math.max(0, until - at);
    spin.value = withDelay(at, withTiming(turning / DOODLE_TURN_MS, { duration: turning, easing: Easing.linear }));
  }, [pop, spin, at, until]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 2),
    transform: [{ translateX: spot.x }, { translateY: spot.y }, { scale: pop.value }, { rotate: `${spin.value * 360}deg` }],
  }));
  return (
    <Animated.View style={[{ position: "absolute", width: POT_DOODLE_SIZE, height: POT_DOODLE_SIZE }, style]}>
      <BoilingDoodle versions={versions} size={POT_DOODLE_SIZE} color={DOODLE_COLORS[index % DOODLE_COLORS.length]} />
    </Animated.View>
  );
}

function Pot({
  mouthY,
  landings,
  doodlesUntil,
  rise,
  bump,
  rattle,
  lid,
}: {
  mouthY: number;
  /** When each pick lands in the mouth (ms into the scene). */
  landings: number[];
  doodlesUntil: number;
  rise: SharedValue<number>;
  bump: SharedValue<number>;
  rattle: SharedValue<number>;
  lid: SharedValue<number>;
}) {
  const potStyle = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [
      { translateY: 40 * (1 - rise.value) },
      { rotate: `${rattle.value * 3}deg` },
      // A little squash each time something drops in.
      { scaleX: 1 + 0.06 * bump.value },
      { scaleY: 1 - 0.06 * bump.value },
    ],
  }));
  const lidStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -34 * lid.value }, { translateX: 18 * lid.value }, { rotate: `${14 * lid.value + rattle.value * 6}deg` }],
  }));

  return (
    <Animated.View
      style={[{ position: "absolute", left: 0, right: 0, top: mouthY - RIM_H - LID_H, alignItems: "center" }, potStyle]}
    >
      {/* Lid, with its knob. */}
      <Animated.View style={[{ alignItems: "center" }, lidStyle]}>
        <View
          className="border-ink-emphasis bg-white"
          style={{ width: 20, height: 11, borderWidth: POT_STROKE, borderBottomWidth: 0, borderTopLeftRadius: 7, borderTopRightRadius: 7 }}
        />
        <View
          className="border-ink-emphasis bg-white"
          style={{
            width: LID_W,
            height: LID_H - 11,
            borderWidth: POT_STROKE,
            borderTopLeftRadius: LID_W / 2,
            borderTopRightRadius: LID_W / 2,
          }}
        />
      </Animated.View>
      {/* Rim, handles and body, with the doodles inside. */}
      <View className="border-ink-emphasis bg-white" style={{ width: RIM_W, height: RIM_H, borderRadius: RIM_H / 2, borderWidth: POT_STROKE, zIndex: 1 }} />
      <View style={{ width: RIM_W + 28, height: POT_H, alignItems: "center", marginTop: -POT_STROKE }}>
        <View className="absolute left-0 border-ink-emphasis" style={{ top: 8, width: 26, height: 14, borderRadius: 7, borderWidth: POT_STROKE }} />
        <View className="absolute right-0 border-ink-emphasis" style={{ top: 8, width: 26, height: 14, borderRadius: 7, borderWidth: POT_STROKE }} />
        <View
          className="items-center justify-center border-ink-emphasis bg-white"
          style={{
            width: POT_W,
            height: POT_H,
            borderWidth: POT_STROKE,
            borderTopWidth: 0,
            borderBottomLeftRadius: 44,
            borderBottomRightRadius: 44,
          }}
        >
          {landings.map((at, i) => (
            <PotDoodle key={i} index={i} at={at} until={doodlesUntil} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

// A puff of steam from under the lifted lid: rises, grows and fades.
function Steam({ at, x, mouthY }: { at: number; x: number; mouthY: number }) {
  const puff = useSharedValue(0);
  useEffect(() => {
    puff.value = withDelay(at, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
  }, [puff, at]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(puff.value, [0, 0.2, 1], [0, 0.5, 0]),
    transform: [{ translateX: x }, { translateY: mouthY - 60 - 70 * puff.value }, { scale: 0.6 + 0.9 * puff.value }],
  }));
  return (
    <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: 0, alignItems: "center" }, style]}>
      <View className="bg-ink-emphasis/10" style={{ width: 34, height: 34, borderRadius: 17 }} />
    </Animated.View>
  );
}

function WelcomeScene({ size, entry, picks, onBang }: { size: IntroSize; entry?: Point; picks: string[]; onBang: (p: Point) => void }) {
  const t = timeline(picks.length);
  const mouthY = size.h * POT_MOUTH;
  // When each pick lands in the pot's mouth.
  const landings = picks.map((_, i) => PICKS_AT + i * PICK_STAGGER_MS + PICK_APPEAR_MS + PICK_FLY_MS * 0.85);
  const sceneRef = useRef<View>(null);
  const bangDotRef = useRef<View>(null);
  // Where the "!"'s dot sits (scene coordinates); the collapse shrinks
  // everything into it.
  const [bang, setBang] = useState<Point | null>(null);
  // The entry hop's ends, once measured (0,0 until then: kept hidden).
  const hopFrom = useSharedValue<Point | null>(null);
  const hopTo = useSharedValue<Point>({ x: 0, y: 0 });
  const mountedAt = useRef(Date.now());

  const greet = useSharedValue(0);
  const fly = useSharedValue(0);
  const land = useSharedValue(0);
  const wave = useSharedValue(0);
  const potRise = useSharedValue(0);
  const potBump = useSharedValue(0);
  const rattle = useSharedValue(0);
  const lid = useSharedValue(0);
  const sorted = useSharedValue(0);
  const note = useSharedValue(0);
  const collapse = useSharedValue(0);

  useEffect(() => {
    greet.value = withDelay(100, withTiming(1, { duration: 350 }));
    potRise.value = withDelay(POT_AT, withSpring(1, POP_SPRING));
    // One squash per pick, as each lands in the mouth.
    potBump.value = withSequence(
      ...landings.map((at, i) =>
        withDelay(
          Math.max(0, at - (i === 0 ? 0 : landings[i - 1] + 250)),
          withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 160 })),
        ),
      ),
    );
    rattle.value = withDelay(
      t.rattleAt,
      withSequence(
        withTiming(-1, { duration: RATTLE_STEP_MS }),
        withTiming(1, { duration: RATTLE_STEP_MS }),
        withTiming(-0.8, { duration: RATTLE_STEP_MS }),
        withTiming(0.6, { duration: RATTLE_STEP_MS }),
        withTiming(0, { duration: RATTLE_STEP_MS }),
      ),
    );
    lid.value = withDelay(t.lidAt, withSpring(1, LID_SPRING));
    sorted.value = withDelay(t.sortedAt, withSpring(1, POP_SPRING));
    note.value = withDelay(t.noteAt, withSpring(1, POP_SPRING));
    collapse.value = withDelay(t.collapseAt, withTiming(1, { duration: COLLAPSE_MS, easing: Easing.in(Easing.cubic) }));
    // Pops on landing, bumping the greeting into its wave.
    land.value = withDelay(ENTRY_MS, withSequence(withTiming(1.4, { duration: 90 }), withSpring(1)));
    wave.value = withDelay(
      ENTRY_MS,
      withSequence(
        withTiming(-1, { duration: WAVE_STEP_MS }),
        withTiming(0.8, { duration: WAVE_STEP_MS }),
        withTiming(-0.5, { duration: WAVE_STEP_MS }),
        withTiming(0.3, { duration: WAVE_STEP_MS }),
        withTiming(0, { duration: WAVE_STEP_MS }),
      ),
    );
    const timers = [
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), ENTRY_MS),
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), t.rattleAt),
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), t.lidAt),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Measured before anything in the greeting moves (it only fades until the
  // dot lands), so transforms don't skew it.
  const measureBang = () => {
    const scene = sceneRef.current;
    const dot = bangDotRef.current;
    if (!scene || !dot) return;
    scene.measureInWindow((sx, sy) => {
      dot.measureInWindow((dx, dy, dw, dh) => {
        const point = { x: dx - sx + dw / 2, y: dy - sy + dh / 2 };
        setBang(point);
        onBang(point);
        if (!entry) return;
        hopTo.value = point;
        hopFrom.value = { x: entry.x - sx, y: entry.y - sy };
        // Lands on the beat, however long measuring took.
        const left = Math.max(150, ENTRY_MS - (Date.now() - mountedAt.current));
        fly.value = withTiming(1, { duration: left, easing: Easing.inOut(Easing.cubic) });
      });
    });
  };

  const greetStyle = useAnimatedStyle(() => ({
    opacity: greet.value,
    transform: [{ rotate: `${wave.value * 7}deg` }],
  }));
  const bangDotStyle = useAnimatedStyle(() => ({
    opacity: land.value > 0 ? 1 : 0,
    transform: [{ scale: land.value }],
  }));
  // Onboarding's indicator pill: squeezes into a ball as it hops up.
  const entryStyle = useAnimatedStyle(() => {
    const from = hopFrom.value;
    const to = hopTo.value;
    if (!from) return { opacity: 0 };
    const f = fly.value;
    const w = interpolate(f, [0, 0.25, 1], [ENTRY_SIZE.width, BANG_DOT, BANG_DOT]);
    const h = interpolate(f, [0, 0.25, 1], [ENTRY_SIZE.height, BANG_DOT, BANG_DOT]);
    const x = from.x + (to.x - from.x) * f;
    const y = from.y + (to.y - from.y) * f - ENTRY_ARC * 4 * f * (1 - f);
    return {
      opacity: land.value > 0 ? 0 : 1,
      width: w,
      height: h,
      borderRadius: h / 2,
      transform: [{ translateX: x - w / 2 }, { translateY: y - h / 2 }],
    };
  });
  // Rises out of the pot as the lid pops.
  const sortedStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, sorted.value * 2),
    transform: [{ translateY: 40 * (1 - sorted.value) }, { scale: 0.7 + 0.3 * sorted.value }],
  }));
  const noteStyle = useAnimatedStyle(() => ({ opacity: note.value, transform: [{ scale: 0.6 + 0.4 * note.value }, { rotate: "-4deg" }] }));
  // Everything shrinks into the "!"'s dot (where PageIntro's dot takes over).
  const collapseStyle = useAnimatedStyle(() => ({ opacity: 1 - collapse.value, transform: [{ scale: 1 - 0.85 * collapse.value }] }));

  return (
    <View ref={sceneRef} collapsable={false} style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: bang ? [bang.x, bang.y, 0] : "center" }, collapseStyle]}>
        <Animated.View style={[{ marginTop: size.h * 0.14 }, greetStyle]} className="items-center">
          <Text className="font-inter-extrabold text-subhero tracking-display text-ink-emphasis">Hey,</Text>
          <View className="flex-row items-end">
            <Text className="font-inter-extrabold text-subhero tracking-display text-ink-emphasis">welcome</Text>
            <View className="ml-1 items-center" style={{ marginBottom: BANG_BASELINE }}>
              <View className="bg-accent" style={{ width: BANG_STEM_W, height: BANG_STEM_H, borderRadius: BANG_STEM_W / 2 }} />
              <Animated.View
                ref={bangDotRef}
                collapsable={false}
                onLayout={measureBang}
                className="bg-accent"
                style={[{ marginTop: BANG_GAP, width: BANG_DOT, height: BANG_DOT, borderRadius: BANG_DOT / 2 }, bangDotStyle]}
              />
            </View>
          </View>
        </Animated.View>

        {/* "Your ulam, sorted." sits above the pot, hidden until the lid pops. */}
        <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: mouthY - 140, alignItems: "center" }, sortedStyle]}>
          <Text className="text-center font-inter-extrabold text-heading-lg tracking-display text-ink-emphasis">
            Your <Text className="text-accent">ulam</Text>, sorted.
          </Text>
        </Animated.View>

        {[-28, 6, 34].map((x, i) => (
          <Steam key={x} at={t.lidAt + i * 120} x={x} mouthY={mouthY} />
        ))}

        <Pot mouthY={mouthY} landings={landings} doodlesUntil={t.collapseAt} rise={potRise} bump={potBump} rattle={rattle} lid={lid} />

        {picks.map((label, i) => (
          <PickChip key={label} label={label} index={i} size={size} mouthY={mouthY} />
        ))}

        <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: mouthY + POT_H + 28, alignItems: "center" }, noteStyle]}>
          <Text className="font-handwritten text-heading-lg text-accent">Tara, kain!</Text>
        </Animated.View>
      </Animated.View>

      {/* Onboarding's indicator dot, on its way to the "!". */}
      {entry && <Animated.View pointerEvents="none" className="bg-accent" style={[{ position: "absolute", left: 0, top: 0 }, entryStyle]} />}
    </View>
  );
}

type HomeIntroProps = {
  active: boolean;
  targetRef: RefObject<View | null>;
  onDone: () => void;
  /** Where onboarding's indicator dot was, in window coordinates. Without
   *  it the "!"'s dot just pops in. */
  entry?: Point;
  /** What the user picked in onboarding, as chip labels (see
   *  OnboardingScreen's picksParam). Empty falls back to sample picks. */
  picks: string[];
};

export function HomeIntro({ active, targetRef, onDone, entry, picks }: HomeIntroProps) {
  const bang = useRef<Point | null>(null);
  const shown = (picks.length > 0 ? picks : FALLBACK_PICKS).slice(0, MAX_PICKS);
  const t = timeline(shown.length);
  return (
    <PageIntro
      active={active}
      targetRef={targetRef}
      onDone={onDone}
      // Takes off from the "!"'s dot, once the scene has collapsed into it.
      dotStart={(size) => bang.current ?? center(size)}
      dotAt={t.dotAt}
      flyAt={t.flyAt}
      dotSize={BANG_DOT}
      accessibilityLabel={`Hey, welcome! Your picks: ${shown.join(", ")}. Your ulam, sorted. Tara, kain!`}
    >
      {(size) => (
        <WelcomeScene
          size={size}
          entry={entry}
          picks={shown}
          onBang={(p) => {
            bang.current = p;
          }}
        />
      )}
    </PageIntro>
  );
}
