import { useEffect } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import { Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { PANTRY_MIN_FOR_SUGGESTIONS, type PantryIngredient } from "../mock/api";
import { usePantryMatches } from "../hooks/usePantryMatches";

const RING_SIZE = 112;
const RING_STROKE = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const RING_SWEEP_MS = 900;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Average match as a ring that sweeps to its value (and re-sweeps when the
// pantry changes), with the % in the middle.
function MatchRing({ percent }: { percent: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(percent / 100, { duration: RING_SWEEP_MS, easing: Easing.out(Easing.cubic) });
  }, [percent]);
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: RING_LENGTH * (1 - progress.value) }));

  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE }} className="items-center justify-center">
      <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: "absolute" }}>
        <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} stroke={colors.primary + "1F"} strokeWidth={RING_STROKE} fill="none" />
        <AnimatedCircle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={colors.primary}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={RING_LENGTH}
          animatedProps={ringProps}
          // Start at 12 o'clock and fill clockwise.
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </Svg>
      <Text className="font-inter-extrabold text-heading text-primary">{percent}%</Text>
      <Text className="font-inter-regular text-sub text-ink-subtle">Average match</Text>
    </View>
  );
}

// "What can you make?": how many catalog meals use what's in the pantry,
// and how much of them on average, with a way to see them.
export function PantryMatchCard({ pantry }: { pantry: PantryIngredient[] }) {
  const { matchedMeals, averageMatch, isLoading } = usePantryMatches(pantry);
  const needed = PANTRY_MIN_FOR_SUGGESTIONS - pantry.length;
  const ready = needed <= 0;

  const seeMeals = () =>
    router.push({
      pathname: "/pantry-results",
      // JSON: ingredient names can contain commas ("Chicken, thigh").
      params: { ids: JSON.stringify(pantry.map((p) => p.id)), names: JSON.stringify(pantry.map((p) => p.name)) },
    });

  return (
    <View className="flex-row items-center gap-4 rounded-3xl bg-mood-bg p-5">
      <View className="flex-1 gap-1">
        <Text className="font-inter-extrabold text-subheading text-ink-emphasis">What can you make?</Text>
        <Text className="font-inter-regular text-small text-ink-subtle">
          {!ready ? (
            `Add ${needed} more ingredient${needed === 1 ? "" : "s"} to see your matches`
          ) : isLoading ? (
            "Finding meals…"
          ) : (
            <>
              <Text className="font-inter-bold text-primary">
                {matchedMeals} meal{matchedMeals === 1 ? "" : "s"}
              </Text>{" "}
              matched your pantry
            </>
          )}
        </Text>
        <View className="mt-3">
          <Button label="See meals" shape="fullPill" onPress={seeMeals} disabled={!ready || matchedMeals === 0} />
        </View>
      </View>
      <MatchRing percent={ready ? averageMatch : 0} />
    </View>
  );
}
