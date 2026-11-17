import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type EntryAnimationsValues,
  type ExitAnimationsValues,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { House } from "lucide-react-native";
import { Text } from "@/frontend/components/ui/Text";
import { showGlobalToast } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { usePantryActions } from "@/frontend/core/pantry/hooks/usePantry";
import { CLEANUP_NOTE_MS, useNudge, type CleanupNote } from "@/frontend/core/pantry/store/useNudgeStore";
import type { PriceItem } from "@/frontend/core/prices/utils/prices";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { PriceDropLine } from "./PriceDropLine";

// With two lines, each shows this long before the next rolls up.
const ROTATE_MS = 10_000;
// The roll: like a split-flap reel, one line up and out as the next comes up
// from below. Eased, no bounce.
const ROLL_MS = 520;
const ROLL_EASE = Easing.inOut(Easing.cubic);
// The marquee: a pause, a slow glide to the end, a pause, back to the start.
const MARQUEE_PAUSE_MS = 1600;
const MARQUEE_MS_PER_PX = 28;
const EASE = Easing.out(Easing.cubic);
// Names spelled out before "and N more".
const NAMES_SHOWN = 3;

// One line's height up (the box clips the rest), not the whole screen like
// Reanimated's own slides.
const rollIn = (values: EntryAnimationsValues) => {
  "worklet";
  return {
    initialValues: { transform: [{ translateY: values.targetHeight }] },
    animations: { transform: [{ translateY: withTiming(0, { duration: ROLL_MS, easing: ROLL_EASE }) }] },
  };
};
const rollOut = (values: ExitAnimationsValues) => {
  "worklet";
  return {
    initialValues: { transform: [{ translateY: 0 }] },
    animations: { transform: [{ translateY: withTiming(-values.currentHeight, { duration: ROLL_MS, easing: ROLL_EASE }) }] },
  };
};

/** The plan-day cleanup's note while it's fresh (12 hours), else null.
 *  Clears itself when the time is up. */
export function useCleanupNote(): CleanupNote | null {
  const { cleanupNote, setCleanupNote } = useNudge();
  const left = cleanupNote ? cleanupNote.at + CLEANUP_NOTE_MS - Date.now() : 0;
  useEffect(() => {
    if (!cleanupNote) return;
    if (left <= 0) return setCleanupNote(null);
    const timer = setTimeout(() => setCleanupNote(null), left);
    return () => clearTimeout(timer);
  }, [cleanupNote?.at]);
  return cleanupNote && left > 0 ? cleanupNote : null;
}

// One line of text that glides sideways when it's longer than its space,
// and back. Reduce motion: cut off with "…" instead.
function Marquee({ children, className }: { children: ReactNode; className: string }) {
  const reduceMotion = useReduceMotion();
  const [boxWidth, setBoxWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const x = useSharedValue(0);
  const overflow = Math.ceil(textWidth - boxWidth);

  useEffect(() => {
    cancelAnimation(x);
    x.value = 0;
    if (reduceMotion || boxWidth === 0 || overflow <= 1) return;
    x.value = withRepeat(
      withSequence(
        withDelay(MARQUEE_PAUSE_MS, withTiming(-overflow, { duration: overflow * MARQUEE_MS_PER_PX, easing: Easing.inOut(Easing.quad) })),
        withDelay(MARQUEE_PAUSE_MS, withTiming(0, { duration: 500, easing: EASE })),
      ),
      -1,
    );
    return () => cancelAnimation(x);
  }, [overflow, boxWidth, reduceMotion]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  if (reduceMotion) {
    return (
      <Text numberOfLines={1} className={`shrink ${className}`}>
        {children}
      </Text>
    );
  }
  // A horizontal ScrollView (not scrollable) lets the text keep its full
  // width to measure and move; the box clips it to the space there is.
  return (
    <ScrollView
      horizontal
      scrollEnabled={false}
      showsHorizontalScrollIndicator={false}
      style={{ flexShrink: 1, flexGrow: 0 }}
      onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View style={style} onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}>
        <Text numberOfLines={1} className={className}>
          {children}
        </Text>
      </Animated.View>
    </ScrollView>
  );
}

function namesOf(note: CleanupNote): ReactNode[] {
  const names = note.items.map((item) => item.name.toLowerCase());
  const shown = names.slice(0, NAMES_SHOWN);
  const more = names.length - shown.length;
  const parts = more > 0 ? [...shown, `${more} more`] : shown;
  return parts.flatMap((part, i) => [
    i === 0 ? "" : i === parts.length - 1 ? " and " : ", ",
    <Text key={part} className="text-home-name">
      {part}
    </Text>,
  ]);
}

// What a finished meal plan day took out of the pantry, on the same glass
// pill as the price line, with Undo for "I didn't actually cook that".
function CleanupLine({ note }: { note: CleanupNote }) {
  const pantryActions = usePantryActions();
  const { setCleanupNote } = useNudge();
  const undo = () => {
    Haptics.selectionAsync();
    pantryActions.addMany(note.items);
    setCleanupNote(null);
    showGlobalToast({ tone: "success", message: "Put back in your pantry" });
  };
  const sentence = `${note.when} is done, so we took ${note.items.map((item) => item.name.toLowerCase()).join(", ")} out of your pantry`;
  return (
    <View
      accessible
      accessibilityLabel={sentence}
      className="flex-row items-center gap-2 self-start rounded-full border border-white/20 bg-white/10 py-1.5 pl-1.5 pr-1.5"
    >
      <View className="h-6 w-6 items-center justify-center rounded-full bg-white/15">
        <House color={colors.home.name} size={14} strokeWidth={2.5} />
      </View>
      <Marquee className="font-inter-semibold text-small text-white">
        {note.when} is done, so we took {namesOf(note)} out of your pantry
      </Marquee>
      <Pressable
        onPress={undo}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Undo: put ${note.items.map((item) => item.name).join(", ")} back in your pantry`}
        className="rounded-full bg-white/15 px-2.5 py-0.5 active:bg-white/25"
      >
        <Text className="font-inter-bold text-small text-home-name">Undo</Text>
      </Pressable>
    </View>
  );
}

// Home's line under the greeting: this week's biggest price drop and, for
// 12 hours after a meal plan day ends, what it took out of the pantry. With
// both, they take turns every 10 seconds, rolling up like a reel (the
// cleanup first, it's news); once undone or expired, the price line stays
// on its own.
export function HomeTicker({ priceDrop }: { priceDrop: PriceItem | null | undefined }) {
  const note = useCleanupNote();
  const reduceMotion = useReduceMotion();
  const lines = [...(note ? (["cleanup"] as const) : []), ...(priceDrop ? (["price"] as const) : [])];
  const [turn, setTurn] = useState(0);
  // The box is one line tall and clips the roll.
  const [height, setHeight] = useState<number | undefined>(undefined);

  // Rolls only while Home is on screen.
  useFocusEffect(
    useCallback(() => {
      if (lines.length < 2) return;
      const timer = setInterval(() => setTurn((n) => n + 1), ROTATE_MS);
      return () => clearInterval(timer);
    }, [lines.length]),
  );

  if (lines.length === 0) return null;
  const line = lines[turn % lines.length];
  // Reduce motion: the lines still take turns, swapping in place.
  const rolls = lines.length > 1 && !reduceMotion;

  return (
    <View className="mt-3 overflow-hidden" style={{ height }}>
      <Animated.View
        key={line === "cleanup" ? `cleanup:${note?.at}:${turn}` : `price:${turn}`}
        entering={rolls ? rollIn : undefined}
        exiting={rolls ? rollOut : undefined}
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      >
        {line === "cleanup" && note ? <CleanupLine note={note} /> : priceDrop ? <PriceDropLine item={priceDrop} /> : null}
      </Animated.View>
    </View>
  );
}
