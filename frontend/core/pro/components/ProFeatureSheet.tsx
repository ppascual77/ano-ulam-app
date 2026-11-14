import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { router } from "expo-router";
import Animated, { Easing, FadeIn, FadeInDown } from "react-native-reanimated";
import { AppText, BottomSheet, Button } from "@/frontend/components/ui";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { ProBadge } from "./ProBadge";
import { TRIAL_DAYS } from "../proContent";
import { useProStore } from "../store/useProStore";
import { AvoidReel } from "./featureReels/AvoidReel";
import { GoalsReel } from "./featureReels/GoalsReel";
import { PlanWeekReel } from "./featureReels/PlanWeekReel";
import { PriceAlertReel } from "./featureReels/PriceAlertReel";

export type ProFeatureKey = "alerts" | "planLength" | "avoid" | "goals";

type Feature = {
  title: string;
  body: string;
  Reel: (props: { active: boolean; reduceMotion: boolean }) => React.ReactNode;
  /** The Pro page's title for it (`title` + an orange `highlight`). */
  pro: { title: string; highlight: string; subtitle: string };
};

const FEATURES: Record<ProFeatureKey, Feature> = {
  alerts: {
    title: "Price drop alerts",
    body: "Know the day an ingredient gets cheaper at the palengke. Only real drops of 5% or more, so every alert is worth it.",
    Reel: PriceAlertReel,
    pro: { title: "Get price drop", highlight: "alerts", subtitle: "Pro tells you the day an ingredient gets cheaper." },
  },
  planLength: {
    title: "Plan your whole week",
    body: "Breakfast, lunch and dinner for 5 or 7 days in one go, within your budget, with one grocery list for all of it.",
    Reel: PlanWeekReel,
    pro: { title: "Plan your whole", highlight: "week", subtitle: "5- or 7-day meal plans and one grocery list with Pro." },
  },
  avoid: {
    title: "Ingredients to avoid",
    body: "Not a fan of ampalaya? Hide every meal that uses it, everywhere in AnoUlam, with one tap.",
    Reel: AvoidReel,
    pro: { title: "Never see it", highlight: "again", subtitle: "Hide meals with any ingredient you don't eat." },
  },
  goals: {
    title: "Nutrition goals",
    body: "Set your calories and protein once. Your plans aim at them, and meals that fit get a tag.",
    Reel: GoalsReel,
    pro: { title: "Eat for your", highlight: "goals", subtitle: "Targets your meal plans aim at, with Pro." },
  },
};

const EASE = Easing.out(Easing.cubic);

// A locked Pro feature, tapped (Settings → Pro features): a short looping
// reel of the feature working on real data, then what it is in a line, and
// the way in (the Pro page, titled for it). One sheet for every feature so
// they feel like a set. Reduce motion: each reel's finished frame.
export function ProFeatureSheet({ feature, onClose }: { feature: ProFeatureKey | null; onClose: () => void }) {
  const reduceMotion = useReduceMotion();
  const canTrial = useProStore((s) => Object.values(s.trialEligible).some(Boolean));
  // The last one stays on screen while the sheet slides away.
  const [shown, setShown] = useState<ProFeatureKey | null>(feature);
  useEffect(() => {
    if (feature) setShown(feature);
  }, [feature]);
  const open = !!feature;
  const f = shown ? FEATURES[shown] : null;
  const fade = (delay: number) => (reduceMotion ? FadeIn.duration(160) : FadeInDown.delay(delay).duration(320).easing(EASE));

  const openPro = () => {
    if (!f) return;
    onClose();
    router.push({ pathname: "/pro", params: { ...f.pro, source: "feature" } });
  };

  return (
    <BottomSheet visible={open} onClose={onClose} fitContent>
      {f && (
        <View className="gap-5 px-6 pb-8 pt-3">
          <Animated.View entering={reduceMotion ? FadeIn.duration(160) : FadeIn.duration(260)}>
            <f.Reel key={shown} active={open} reduceMotion={reduceMotion} />
          </Animated.View>

          <Animated.View entering={fade(140)} className="gap-2">
            <View className="flex-row items-center gap-2">
              <ProBadge />
            </View>
            <AppText variant="sectionTitle" dot>
              {f.title}
            </AppText>
            <Text className="font-inter-regular text-body text-ink-subtle">{f.body}</Text>
          </Animated.View>

          <Animated.View entering={fade(240)} className="gap-3">
            <Button label={canTrial ? `Try Pro free for ${TRIAL_DAYS} days` : "Get Pro"} variant="secondary" onPress={openPro} />
            <Pressable onPress={onClose} hitSlop={8} className="self-center active:opacity-60">
              <Text className="font-inter-semibold text-body text-ink-subtle">Not now</Text>
            </Pressable>
          </Animated.View>
        </View>
      )}
    </BottomSheet>
  );
}
