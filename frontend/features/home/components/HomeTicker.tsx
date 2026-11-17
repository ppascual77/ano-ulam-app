import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
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

// With two lines, each shows this long before the other fades in.
const ROTATE_MS = 5000;

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
  return (
    <View className="mt-3 flex-row items-center gap-2 self-start rounded-full border border-white/20 bg-white/10 py-1.5 pl-1.5 pr-1.5">
      <View className="h-6 w-6 items-center justify-center rounded-full bg-white/15">
        <House color={colors.home.name} size={14} strokeWidth={2.5} />
      </View>
      <Text numberOfLines={1} className="shrink font-inter-semibold text-small text-white">
        {note.text}
      </Text>
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
// both, they take turns every few seconds (the cleanup first, it's news);
// once undone or expired, the price line stays on its own.
export function HomeTicker({ priceDrop }: { priceDrop: PriceItem | null | undefined }) {
  const note = useCleanupNote();
  const reduceMotion = useReduceMotion();
  const lines = [...(note ? (["cleanup"] as const) : []), ...(priceDrop ? (["price"] as const) : [])];
  const [turn, setTurn] = useState(0);

  // Rotates only while Home is on screen.
  useFocusEffect(
    useCallback(() => {
      if (lines.length < 2) return;
      const timer = setInterval(() => setTurn((n) => n + 1), ROTATE_MS);
      return () => clearInterval(timer);
    }, [lines.length]),
  );

  if (lines.length === 0) return null;
  const line = lines[turn % lines.length];
  const fadeIn = FadeIn.duration(reduceMotion ? 150 : 320);
  const fadeOut = FadeOut.duration(reduceMotion ? 100 : 200);

  return (
    <Animated.View key={line === "cleanup" ? `cleanup:${note?.at}` : "price"} entering={lines.length > 1 ? fadeIn : undefined} exiting={fadeOut}>
      {line === "cleanup" && note ? <CleanupLine note={note} /> : priceDrop ? <PriceDropLine item={priceDrop} /> : null}
    </Animated.View>
  );
}
