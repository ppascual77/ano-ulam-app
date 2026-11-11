import { useEffect, useMemo } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { Ban } from "lucide-react-native";
import Animated, { FadeIn, LinearTransition, ZoomIn, ZoomOut, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { colors } from "@/frontend/constants/theme";
import { usePreferredMeals } from "@/frontend/core/meals/hooks/usePreferredMeals";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { REEL_HEIGHT, useReelTick } from "./useReelTick";

const STEP_MS = 650;
// 0 all meals · 1 the chip is tapped · 2 its meals leave · 3-6 rest · 7 back.
const STEPS = 8;
const TILE = 62;
// The first word with real meals to hide wins: the classic dislike first.
const TERMS = ["ampalaya", "shrimp", "pork"];

function pickScene(meals: MealType[]) {
  const withPhoto = meals.filter((m) => m.image_url);
  for (const term of TERMS) {
    const hidden = withPhoto.filter((m) => m.name.toLowerCase().includes(term)).slice(0, 2);
    if (hidden.length === 0) continue;
    const kept = withPhoto.filter((m) => !m.name.toLowerCase().includes(term)).slice(0, 6 - hidden.length);
    // Interleaved, so the gaps close from the middle of the grid.
    const tiles = [kept[0], hidden[0], kept[1], kept[2], hidden[1], kept[3]].filter(Boolean) as MealType[];
    return { term: term[0].toUpperCase() + term.slice(1), tiles, hiddenIds: new Set(hidden.map((m) => m.id)) };
  }
  return null;
}

// Ingredients to avoid: a grid of real meals; the "Avoid ampalaya" chip is
// tapped, the meals using it shrink away, the rest close the gap, and a
// count says how many were hidden. Reduce motion: the after state.
export function AvoidReel({ active, reduceMotion }: { active: boolean; reduceMotion: boolean }) {
  const { meals } = usePreferredMeals();
  const scene = useMemo(() => pickScene(meals), [meals]);
  const tick = useReelTick(active && !reduceMotion, STEP_MS);
  const step = reduceMotion ? 3 : tick % STEPS;
  const on = step >= 1 && step < STEPS - 1;
  const hiding = step >= 2 && step < STEPS - 1;
  const press = useSharedValue(1);
  useEffect(() => {
    if (step === 1 && !reduceMotion) press.value = withSequence(withTiming(0.88, { duration: 110 }), withSpring(1, { damping: 9, stiffness: 260 }));
  }, [step]);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  if (!scene) return <View style={{ height: REEL_HEIGHT }} className="rounded-3xl bg-mood-bg" />;
  const tiles = hiding ? scene.tiles.filter((m) => !scene.hiddenIds.has(m.id)) : scene.tiles;

  return (
    <View style={{ height: REEL_HEIGHT }} className="items-center justify-center gap-4 overflow-hidden rounded-3xl bg-mood-bg px-4">
      <Animated.View style={pressStyle}>
        <View className={`flex-row items-center gap-1.5 rounded-full border px-3.5 py-2 ${on ? "border-like bg-like-soft" : "border-ink-emphasis/10 bg-white"}`}>
          <Ban color={on ? colors.like : colors.ink.subtle} size={14} strokeWidth={2.5} />
          <Text className={`font-inter-bold text-small ${on ? "text-like" : "text-ink-emphasis"}`}>
            {on ? `Avoiding ${scene.term.toLowerCase()}` : `Avoid ${scene.term.toLowerCase()}`}
          </Text>
        </View>
      </Animated.View>

      <View className="flex-row flex-wrap justify-center" style={{ width: TILE * 3 + 16, gap: 8, minHeight: TILE * 2 + 8 }}>
        {tiles.map((m) => (
          <Animated.View
            key={m.id}
            layout={reduceMotion ? undefined : LinearTransition.springify().damping(15)}
            entering={reduceMotion ? undefined : ZoomIn.duration(220)}
            exiting={reduceMotion ? undefined : ZoomOut.duration(260)}
          >
            <Image source={resolveMealImage(m)} style={{ width: TILE, height: TILE, borderRadius: 14 }} contentFit="cover" />
          </Animated.View>
        ))}
      </View>

      <View className="h-5">
        {hiding && (
          <Animated.Text entering={FadeIn.duration(200)} className="font-inter-semibold text-sub text-ink-subtle">
            {scene.hiddenIds.size} {scene.hiddenIds.size === 1 ? "meal" : "meals"} with {scene.term.toLowerCase()} hidden, everywhere
          </Animated.Text>
        )}
      </View>
    </View>
  );
}
