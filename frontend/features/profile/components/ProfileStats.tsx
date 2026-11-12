import { Fragment } from "react";
import { Pressable, Text, View } from "react-native";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { useCountUp } from "../hooks/useCountUp";

export type ProfileStat = {
  label: string;
  value: number;
  /** Tap: e.g. switch to that tab. */
  onPress?: () => void;
};

// Same ease-out cubic as the tab bar, a little longer so the numbers read.
const COUNT_MS = 600;

// Numbers under the bio (Saved · Recipes · Posts), counting up from 0
// when they first load. Tabular figures so they don't jitter while counting.
export function ProfileStats({ stats }: { stats: ProfileStat[] }) {
  return (
    <View className="mt-4 flex-row items-center self-stretch">
      {stats.map((stat, i) => (
        <Fragment key={stat.label}>
          {i > 0 && <View className="h-6 w-px bg-ink-emphasis/10" />}
          <StatItem {...stat} />
        </Fragment>
      ))}
    </View>
  );
}

function StatItem({ label, value, onPress }: ProfileStat) {
  const reduceMotion = useReduceMotion();
  const counted = useCountUp(value, reduceMotion ? 0 : COUNT_MS);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${value} ${label}`}
      className="flex-1 items-center py-1 active:opacity-60"
    >
      <Text className="font-inter-bold text-subheading text-ink-emphasis" style={{ fontVariant: ["tabular-nums"] }}>
        {Math.round(counted)}
      </Text>
      <Text className="mt-0.5 font-inter-regular text-small text-ink-subtle">{label}</Text>
    </Pressable>
  );
}
