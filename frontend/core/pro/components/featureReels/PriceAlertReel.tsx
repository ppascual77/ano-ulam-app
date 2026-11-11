import { useEffect, useMemo } from "react";
import { Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { colors } from "@/frontend/constants/theme";
import { usePriceItems } from "@/frontend/core/prices/hooks/usePriceItems";
import { commodityShortName } from "@/frontend/core/prices/hooks/useBiggestPriceDrop";
import { REEL_HEIGHT, useReelTick } from "./useReelTick";

// One notification's turn: drop in, rest, lift away.
const PERIOD_MS = 3400;
const HOLD_MS = 2300;
const PHONE_W = 236;
const OFF = -120;

type Drop = { title: string; body: string };

// Today's real drops, so the reel is the actual product; a sample before
// prices load (or on a day with none).
const SAMPLE: Drop[] = [
  { title: "🔻 Tilapia is 12% cheaper", body: "Now ₱140/kg, down from ₱159 a week ago." },
  { title: "🔻 Red Onion is 18% cheaper", body: "Now ₱104/kg, down from ₱127 a week ago." },
];

function useDrops(): Drop[] {
  const { data } = usePriceItems();
  return useMemo(() => {
    const drops = (data ?? [])
      .filter((i) => i.pctChange != null && i.pctChange <= -5 && i.weekAgoPrice != null)
      .sort((a, b) => (a.pctChange ?? 0) - (b.pctChange ?? 0))
      .slice(0, 3)
      .map((i) => ({
        title: `🔻 ${commodityShortName(i)} is ${Math.round(Math.abs(i.pctChange ?? 0))}% cheaper`,
        body: `Now ₱${Math.round(i.latestPrice)}/${i.unit === "piece" ? "pc" : i.unit}, down from ₱${Math.round(i.weekAgoPrice ?? 0)} a week ago.`,
      }));
    return drops.length > 0 ? drops : SAMPLE;
  }, [data]);
}

function Notification({ drop }: { drop: Drop }) {
  return (
    <View className="flex-row gap-2.5 rounded-2xl bg-white/95 p-3 shadow-md">
      <Image source={require("@/assets/icon.png")} style={{ width: 30, height: 30, borderRadius: 8 }} />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="font-inter-bold text-sub text-ink-emphasis">AnoUlam</Text>
          <Text className="font-inter-regular text-sub text-ink-subtle">now</Text>
        </View>
        <Text numberOfLines={1} className="font-inter-bold text-small text-ink-emphasis">
          {drop.title}
        </Text>
        <Text numberOfLines={2} className="font-inter-regular text-sub text-ink">
          {drop.body}
        </Text>
      </View>
    </View>
  );
}

// Price drop alerts: the top of a phone's lock screen, and today's real
// price drops arriving one after another as AnoUlam notifications (a soft
// tap each time one lands), the one before resting behind it.
export function PriceAlertReel({ active, reduceMotion }: { active: boolean; reduceMotion: boolean }) {
  const drops = useDrops();
  const tick = useReelTick(active && !reduceMotion, PERIOD_MS);
  const index = tick % drops.length;
  const y = useSharedValue(reduceMotion ? 0 : OFF);
  const ghost = useSharedValue(0);

  useEffect(() => {
    if (!active || reduceMotion) {
      y.value = 0;
      return;
    }
    y.value = withSequence(
      withTiming(OFF, { duration: 0 }),
      withSpring(0, { damping: 13, stiffness: 170, mass: 0.8 }),
      withDelay(HOLD_MS, withTiming(OFF, { duration: 320, easing: Easing.in(Easing.cubic) })),
    );
    // The stack behind appears after the first one lands.
    ghost.value = withDelay(tick === 0 ? 900 : 0, withTiming(tick === 0 ? 0 : 1, { duration: 300 }));
    const tap = setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 380);
    return () => clearTimeout(tap);
  }, [tick, active, reduceMotion]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { scale: 0.96 + 0.04 * (1 - Math.min(1, Math.abs(y.value) / -OFF)) }],
    opacity: 1 - Math.min(1, Math.abs(y.value) / -OFF) * 0.6,
  }));
  const ghostStyle = useAnimatedStyle(() => ({ opacity: 0.5 * ghost.value }));
  const now = new Date();

  return (
    <View style={{ height: REEL_HEIGHT }} className="items-center overflow-hidden rounded-3xl bg-mood-bg">
      {/* The phone, cut off by the stage: only its top shows. */}
      <View style={{ width: PHONE_W, marginTop: 22, height: REEL_HEIGHT + 40, borderRadius: 40 }} className="bg-ink-emphasis p-1.5">
        <View style={{ flex: 1, borderRadius: 34, overflow: "hidden" }}>
          <LinearGradient colors={[colors.home.top, colors.primary]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <View className="mt-2.5 h-5 w-20 self-center rounded-full bg-ink-emphasis" />
          <Text className="mt-2 text-center font-inter-medium text-sub text-white/75">
            {now.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}
          </Text>
          <Text className="text-center font-inter-bold text-hero text-white/90">
            {now.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: false })}
          </Text>
          <View className="absolute left-2.5 right-2.5" style={{ top: 112 }}>
            {/* The one before, resting behind. */}
            <Animated.View style={[{ position: "absolute", left: 10, right: 10, top: 10, transform: [{ scale: 0.92 }] }, ghostStyle]}>
              <Notification drop={drops[(index + drops.length - 1) % drops.length]} />
            </Animated.View>
            <Animated.View style={cardStyle}>
              <Notification drop={drops[index]} />
            </Animated.View>
          </View>
        </View>
      </View>
    </View>
  );
}
