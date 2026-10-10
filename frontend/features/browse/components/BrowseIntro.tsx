import { type RefObject, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { BicepsFlexed, PiggyBank, Timer, type LucideIcon } from "lucide-react-native";
import { PageIntro, type IntroSize } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

// A quick glance at what Browse is:
//   0.0s   "What are you craving?" rises in
//   0.2s   a slot-machine reel of dishes spins, easing to a stop on one
//   1.55s  "sounds good today!" (handwritten) pops under it
//   1.75s  the three ulam moods pop in: Tipid, High Protein, Quick & Easy
//   2.35s  everything collapses into one dot
//   2.75s  the cover fades to the real page as the dot arcs up and lands as
//          the period of the "Browse." header (see PageIntro)
const SPIN_AT = 200;
const SPIN_MS = 1300;
const NOTE_AT = 1550;
const MOODS_AT = 1750;
const MOOD_STAGGER_MS = 110;
const COLLAPSE_AT = 2350;
const COLLAPSE_MS = 380;
const DOT_AT = COLLAPSE_AT + 60;
const FLY_AT = 2750;

// The reel: spins through these (twice, for speed), landing on the last.
const DISHES = ["Adobo", "Sisig", "Tinola", "Kare-Kare", "Laing", "Pancit", "Lechon", "Bulalo"];
const LANDS_ON = "Sinigang";
const REEL = [...DISHES, ...DISHES, LANDS_ON];
const ITEM_HEIGHT = 64;

const MOODS: { label: string; icon: LucideIcon; tilt: string }[] = [
  { label: "Tipid Meals", icon: PiggyBank, tilt: "-4deg" },
  { label: "High Protein", icon: BicepsFlexed, tilt: "2deg" },
  { label: "Quick & Easy", icon: Timer, tilt: "5deg" },
];
const POP_SPRING = { damping: 8, stiffness: 220, mass: 0.5 };

// Where everything collapses to, and the dot appears.
const collapsePoint = (size: IntroSize) => ({ x: size.w / 2, y: size.h / 2 });

function MoodChip({ label, icon: Icon, tilt, index }: { label: string; icon: LucideIcon; tilt: string; index: number }) {
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = withDelay(MOODS_AT + index * MOOD_STAGGER_MS, withSpring(1, POP_SPRING));
  }, [pop, index]);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 2), transform: [{ scale: pop.value }, { rotate: tilt }] }));
  return (
    <Animated.View style={style} className="flex-row items-center gap-1.5 rounded-full border border-ink-emphasis/10 bg-mood-bg px-3 py-2">
      <Icon color={colors.primary} size={16} />
      <Text className="font-inter-semibold text-small text-ink-emphasis">{label}</Text>
    </Animated.View>
  );
}

function CravingScene({ size }: { size: IntroSize }) {
  const spin = useSharedValue(0);
  const note = useSharedValue(0);
  const collapse = useSharedValue(0);
  useEffect(() => {
    spin.value = withDelay(SPIN_AT, withTiming(1, { duration: SPIN_MS, easing: Easing.out(Easing.cubic) }));
    note.value = withDelay(NOTE_AT, withSpring(1, POP_SPRING));
    collapse.value = withDelay(COLLAPSE_AT, withTiming(1, { duration: COLLAPSE_MS, easing: Easing.in(Easing.cubic) }));
  }, [spin, note, collapse]);

  const reelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -(REEL.length - 1) * ITEM_HEIGHT * spin.value }] }));
  const noteStyle = useAnimatedStyle(() => ({ opacity: note.value, transform: [{ scale: 0.6 + 0.4 * note.value }, { rotate: "-4deg" }] }));
  // The whole scene shrinks into the middle of the screen (where the dot
  // appears) and fades.
  const collapseStyle = useAnimatedStyle(() => ({
    opacity: 1 - collapse.value,
    transform: [{ scale: 1 - 0.85 * collapse.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, collapseStyle]}>
      <Animated.View entering={FadeInDown.duration(450)} className="items-center" style={{ marginTop: size.h * 0.16 }}>
        <Text className="font-inter-medium text-subheading text-ink-subtle">What are you craving?</Text>
      </Animated.View>

      {/* Slot-machine window: one dish visible, soft white fades top and
          bottom so the spin reads as a reel. */}
      <View className="mt-3 overflow-hidden" style={{ height: ITEM_HEIGHT }}>
        <Animated.View style={reelStyle}>
          {REEL.map((dish, i) => (
            <Text
              key={i}
              style={{ height: ITEM_HEIGHT, lineHeight: ITEM_HEIGHT }}
              className={`text-center font-inter-extrabold text-subhero tracking-display ${
                i === REEL.length - 1 ? "text-accent" : "text-ink-emphasis"
              }`}
            >
              {dish}
            </Text>
          ))}
        </Animated.View>
        <LinearGradient
          pointerEvents="none"
          colors={[colors.white, "rgba(255,255,255,0)", "rgba(255,255,255,0)", colors.white]}
          locations={[0, 0.25, 0.75, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <Animated.View className="items-center" style={noteStyle}>
        <Text className="font-handwritten text-heading-lg text-accent">sounds good today!</Text>
      </Animated.View>

      <View className="mt-10 flex-row flex-wrap justify-center gap-2 px-4">
        {MOODS.map((mood, i) => (
          <MoodChip key={mood.label} {...mood} index={i} />
        ))}
      </View>
    </Animated.View>
  );
}

type BrowseIntroProps = {
  active: boolean;
  targetRef: RefObject<View | null>;
  onDone: () => void;
};

export function BrowseIntro({ active, targetRef, onDone }: BrowseIntroProps) {
  return (
    <PageIntro
      active={active}
      targetRef={targetRef}
      onDone={onDone}
      dotStart={collapsePoint}
      dotAt={DOT_AT}
      flyAt={FLY_AT}
      accessibilityLabel="Browse: search any dish you're craving, or pick by mood: tipid, high protein, or quick and easy."
    >
      {(size) => <CravingScene size={size} />}
    </PageIntro>
  );
}
