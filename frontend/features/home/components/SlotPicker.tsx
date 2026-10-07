import { useEffect, useRef } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { colors } from "@/frontend/constants/theme";
import { SLOT_FILLER_NAMES } from "../mock/slotFillerNames";

// "Surprise me" slot reel: a white window that spins through dish names
// fast, slows down, and lands on the picked meal. Sound is ONE baked file
// (assets/sounds/slot-spin.wav) started with the spin: a click for every name
// crossing the center, rattling at full speed and slowing to distinct clicks,
// then a soft bubble pop on landing. Each name also gets a selection haptic,
// like a picker wheel. Then it pops and steps aside for the card reveal.

// The spin. slot-spin.wav has these baked in: if you change any of them,
// update assets/sounds/generate-slot-spin.mjs to match and re-run it.
const SPIN_ITEMS = 30; // how many names roll past before landing
const SPIN_MS = 1800;
const SPIN_EASE_POWER = 2; // ease-out: fast start, settles onto the winner
// Below this many real meals, filler names pad the reel.
const MIN_POOL = 12;
const ROW_HEIGHT = 56;
const VISIBLE_ROWS = 3;
// At full speed names pass every ~15ms; haptics that close blur into a
// buzz, so they keep a minimum gap.
const TICK_HAPTIC_MIN_GAP_MS = 60;
const SPIN_VOLUME = 0.45;
// The confetti "ta-da" sits well under the spin: felt more than heard.
const CONFETTI_VOLUME = 0.2;
const LAND_HOLD_MS = 450; // pause on the winner before the card takes over
const EXIT_MS = 200;
const LAND_POP = { damping: 6, stiffness: 260, mass: 0.6 };
const EDGE_FADE = [colors.white, "rgba(255,255,255,0)"] as const;

export type Reel = {
  names: string[];
  /** Index of the picked meal in `names`; one more name follows it, so the
   *  row under the winner isn't empty once it lands. */
  landAt: number;
};

/** Spin order for the reel: mostly the real meals, padded with filler names
 *  only while there are too few, never the same name twice in a row, and
 *  always landing on `winner`. */
export function buildReel(winner: string, available: string[]): Reel {
  const real = [...new Set(available)].filter((n) => n !== winner);
  const fillers = SLOT_FILLER_NAMES.filter((n) => n !== winner && !real.includes(n));
  const pool = real.length >= MIN_POOL ? real : [...real, ...fillers.slice(0, MIN_POOL - real.length)];
  const names: string[] = [];
  const pushRandom = () => {
    let next = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1) while (next === names[names.length - 1]) next = pool[Math.floor(Math.random() * pool.length)];
    names.push(next);
  };
  for (let i = 0; i < SPIN_ITEMS - 1; i++) pushRandom();
  names.push(winner);
  pushRandom(); // peeks in below the winner
  return { names, landAt: SPIN_ITEMS - 1 };
}

export type SlotSounds = {
  /** The spin started: plays the baked spin sound from the top. */
  start: () => void;
  /** Dismissed mid-spin: silence the rest of it. */
  stop: () => void;
  /** One name passed the center: a selection haptic (throttled). */
  tick: () => void;
  /** Landed on the winner: a firmer haptic (the pop is in the sound). */
  land: () => void;
  /** The card landed and the confetti fell: a soft wooden "ta-da". */
  confetti: () => void;
};

/** The reveal's sounds and haptics (the reel's, plus the confetti "ta-da").
 *  Call it somewhere that stays mounted (the reveal card does), not in
 *  SlotPicker itself: players load their files asynchronously, and created
 *  at spin time they wouldn't be ready to start. */
export function useSlotSounds(): SlotSounds {
  const spinPlayer = useAudioPlayer(require("@/assets/sounds/slot-spin.wav"));
  const confettiPlayer = useAudioPlayer(require("@/assets/sounds/confetti.wav"));
  const lastHapticAt = useRef(0);

  useEffect(() => {
    // UI sounds follow the ring/silent switch (and play alongside any music
    // the user has on, rather than pausing it).
    void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" }).catch(() => {});
  }, []);

  return {
    start: () => {
      spinPlayer.volume = SPIN_VOLUME;
      void spinPlayer.seekTo(0);
      spinPlayer.play();
    },
    stop: () => spinPlayer.pause(),
    tick: () => {
      const now = Date.now();
      if (now - lastHapticAt.current < TICK_HAPTIC_MIN_GAP_MS) return;
      lastHapticAt.current = now;
      void Haptics.selectionAsync().catch(() => {});
    },
    land: () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    },
    confetti: () => {
      confettiPlayer.volume = CONFETTI_VOLUME;
      void confettiPlayer.seekTo(0);
      confettiPlayer.play();
    },
  };
}

type SlotPickerProps = {
  /** From buildReel. */
  reel: Reel;
  /** From useSlotSounds, owned by a parent that stays mounted. */
  sounds: SlotSounds;
  /** Fires once it has landed, held, and faded out. */
  onDone: () => void;
};

export function SlotPicker({ reel, sounds, onDone }: SlotPickerProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { names, landAt: last } = reel;
  const { start, stop, tick, land } = sounds;
  // Reel position, in rows (0 = first name centered, last = winner centered).
  const pos = useSharedValue(0);
  const pop = useSharedValue(1);
  const enter = useSharedValue(0);
  const exit = useSharedValue(0);
  const landed = useSharedValue(false);

  useEffect(() => {
    enter.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    // Fast start, slow settle onto the winner; the baked sound starts with it.
    start();
    pos.value = withTiming(last, { duration: SPIN_MS, easing: Easing.out(Easing.poly(SPIN_EASE_POWER)) }, (finished) => {
      if (!finished) return;
      landed.value = true;
      scheduleOnRN(land);
      pop.value = withSequence(withTiming(1.06, { duration: 90 }), withSpring(1, LAND_POP));
      exit.value = withDelay(LAND_HOLD_MS, withTiming(1, { duration: EXIT_MS }, (done) => {
        if (done) scheduleOnRN(onDone);
      }));
    });
    // Dismissed mid-spin: stop here, so onDone never fires for a closed reveal
    // (a cancelled withTiming calls back with finished = false).
    return () => {
      cancelAnimation(pos);
      cancelAnimation(exit);
      // Only silence a spin that never landed; after landing, let the pop
      // finish on its own.
      if (!landed.value) stop();
    };
    // Runs once per spin (the reel remounts for each pull).
  }, []);

  useAnimatedReaction(
    () => Math.floor(pos.value + 0.5),
    (row, prev) => {
      // The winner's row gets the landing haptic instead of a tick.
      if (prev !== null && row !== prev && row < last) scheduleOnRN(tick);
    },
  );

  const windowStyle = useAnimatedStyle(() => ({
    opacity: enter.value * (1 - exit.value),
    transform: [{ translateY: (1 - enter.value) * 40 - exit.value * 30 }, { scale: pop.value * (1 - exit.value * 0.1) }],
  }));
  // Centers row `pos` in the middle of the window.
  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ROW_HEIGHT - pos.value * ROW_HEIGHT }] }));
  // The center band warms from green to paper-tag cream once it lands.
  const landedBandStyle = useAnimatedStyle(() => ({ opacity: withTiming(landed.value ? 1 : 0, { duration: 150 }) }));

  const windowWidth = screenWidth * 0.82;
  const windowHeight = ROW_HEIGHT * VISIBLE_ROWS;

  return (
    <Animated.View style={[{ width: windowWidth, height: windowHeight }, windowStyle]} className="overflow-hidden rounded-3xl bg-white shadow-lg">
      <View style={{ top: ROW_HEIGHT, height: ROW_HEIGHT }} className="absolute left-3 right-3 rounded-2xl bg-tinted-bg" />
      <Animated.View style={[{ top: ROW_HEIGHT, height: ROW_HEIGHT }, landedBandStyle]} className="absolute left-3 right-3 rounded-2xl bg-tag-bg" />
      <Animated.View style={stripStyle}>
        {names.map((name, i) => (
          <View key={i} style={{ height: ROW_HEIGHT }} className="items-center justify-center px-4">
            <Text numberOfLines={1} className="font-inter-extrabold text-heading text-ink-emphasis">
              {name}
            </Text>
          </View>
        ))}
      </Animated.View>
      {/* Names fade out toward the top and bottom edges. */}
      <LinearGradient colors={EDGE_FADE} pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: ROW_HEIGHT }} />
      <LinearGradient colors={EDGE_FADE} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }} pointerEvents="none" style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: ROW_HEIGHT }} />
    </Animated.View>
  );
}
