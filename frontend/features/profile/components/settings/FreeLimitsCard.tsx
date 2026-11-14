import { useCallback, useEffect } from "react";
import { View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { useFocusEffect } from "expo-router";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { colors } from "@/frontend/constants/theme";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { useDailyLimit, type LimitKind } from "@/frontend/core/pro/dailyLimits";
import {
  FREE_DAILY_SEARCHES,
  FREE_DAILY_SUGGESTIONS,
  GUEST_DAILY_SEARCHES,
  GUEST_DAILY_SUGGESTIONS,
} from "@/frontend/core/pro/proContent";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { useSavedMeals } from "@/frontend/core/saved/hooks/useSavedMeals";
import { SAVED_MEALS_LIMIT } from "@/frontend/core/saved/types";

// At or past this share, the meter turns orange with a nudge.
const ALMOST_FULL = 0.8;
const FILL_MS = 700;

// One meter: label, "8 of 10", a bar that fills to the share used.
function Meter({ label, used, limit, index, last }: { label: string; used: number; limit: number; index: number; last: boolean }) {
  const reduce = useReduceMotion();
  const share = limit > 0 ? Math.min(1, used / limit) : 0;
  const full = share >= ALMOST_FULL;
  const fill = useSharedValue(reduce ? share : 0);
  useEffect(() => {
    fill.value = reduce ? share : withDelay(150 + index * 90, withTiming(share, { duration: FILL_MS, easing: Easing.out(Easing.cubic) }));
  }, [share, index, reduce, fill]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View className={`py-3 ${last ? "" : "border-b border-ink-emphasis/5"}`}>
      <View className="flex-row items-center justify-between">
        <Text className="font-inter-semibold text-body text-ink-emphasis">{label}</Text>
        <Text className="font-inter-semibold text-body text-ink-placeholder">
          <Text className="text-ink-emphasis">{used}</Text> of {limit}
        </Text>
      </View>
      <View className="mt-2 h-2 overflow-hidden rounded-full bg-ink-emphasis/5">
        {/* Plain style on the animated fill (NativeWind can knock out
            Reanimated's animated values). */}
        <Animated.View style={[{ height: "100%", borderRadius: 999, backgroundColor: full ? colors.accent : colors.primary }, fillStyle]} />
      </View>
      {full && <Text className="mt-1.5 font-inter-semibold text-sub text-accent">{used >= limit ? "All used. Pro has no limit." : "Almost full. Pro has no limit."}</Text>}
    </View>
  );
}

// A free account's (or a guest's) limits as meters: saved meals (in total),
// and today's searches, budget suggestions and pantry matches (reset each
// day). Re-read whenever Settings comes back into view.
export function FreeLimitsCard() {
  const { isSignedIn } = useAuth();
  const { data: saved = [] } = useSavedMeals();
  const tier = (guest: number, free: number) => (isSignedIn ? free : guest);
  const kinds: { kind: LimitKind; label: string; limit: number }[] = [
    { kind: "search", label: "Searches today", limit: tier(GUEST_DAILY_SEARCHES, FREE_DAILY_SEARCHES) },
    { kind: "budget", label: "Budget suggestions today", limit: tier(GUEST_DAILY_SUGGESTIONS, FREE_DAILY_SUGGESTIONS) },
    { kind: "pantry", label: "Pantry matches today", limit: tier(GUEST_DAILY_SUGGESTIONS, FREE_DAILY_SUGGESTIONS) },
  ];
  const search = useDailyLimit("search", kinds[0].limit);
  const budget = useDailyLimit("budget", kinds[1].limit);
  const pantry = useDailyLimit("pantry", kinds[2].limit);
  const daily = [search, budget, pantry];
  useFocusEffect(
    useCallback(() => {
      search.refresh();
      budget.refresh();
      pantry.refresh();
    }, [search.refresh, budget.refresh, pantry.refresh]),
  );

  const rows = [
    { label: "Saved meals", used: Math.min(saved.length, SAVED_MEALS_LIMIT), limit: SAVED_MEALS_LIMIT },
    ...kinds.map((k, i) => ({ label: k.label, used: daily[i].left == null ? 0 : Math.max(0, k.limit - daily[i].left!), limit: k.limit })),
  ];

  return (
    <View className="rounded-2xl border border-ink-emphasis/10 px-5 py-1">
      {rows.map((r, i) => (
        <Meter key={r.label} label={r.label} used={r.used} limit={r.limit} index={i} last={i === rows.length - 1} />
      ))}
    </View>
  );
}
