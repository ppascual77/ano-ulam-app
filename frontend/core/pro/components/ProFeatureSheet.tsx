import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight, Sparkles } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import Animated, { Easing, FadeIn, FadeInDown } from "react-native-reanimated";
import { AppText, BottomSheet, Button } from "@/frontend/components/ui";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { ProBadge } from "./ProBadge";
import { COMPARE_ROWS, TRIAL_DAYS } from "../proContent";
import { useProStore } from "../store/useProStore";
import { AvoidReel } from "./featureReels/AvoidReel";
import { GoalsReel } from "./featureReels/GoalsReel";
import { PlanWeekReel } from "./featureReels/PlanWeekReel";
import { PriceAlertReel } from "./featureReels/PriceAlertReel";
import { NarrationReel } from "./featureReels/NarrationReel";
import { MicronutrientsReel } from "./featureReels/MicronutrientsReel";
import { SavesReel } from "./featureReels/SavesReel";
import { SAVED_MEALS_LIMIT } from "@/frontend/core/saved/types";

export type ProFeatureKey = "alerts" | "planLength" | "avoid" | "goals" | "narration" | "micronutrients" | "saves";

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
  narration: {
    title: "Cook mode, read aloud",
    body: "Hands in the pan? Every step is read out loud, and the next one comes up on its own when it's done. Free accounts get 1 meal a day.",
    Reel: NarrationReel,
    pro: { title: "Cook with your hands", highlight: "free", subtitle: "Every meal read aloud, step by step, with Pro." },
  },
  micronutrients: {
    title: "Fiber, sugar and sodium",
    body: "See how much of your daily fiber, sugar and sodium every meal takes up, per serving, with a quick read on what's high and what's a good source.",
    Reel: MicronutrientsReel,
    pro: { title: "Know what's in", highlight: "every", subtitle: "Fiber, sugar and sodium on every meal, with Pro." },
  },
  saves: {
    title: "Save every meal you like",
    body: `Free accounts keep ${SAVED_MEALS_LIMIT} saved meals. With Pro there's no cap: save every ulam you want to cook, and all of them go on your grocery list.`,
    Reel: SavesReel,
    pro: { title: "Save as many as you", highlight: "want", subtitle: "No limit on saved meals with Pro." },
  },
  goals: {
    title: "Nutrition goals",
    body: "Set your calories and protein once. Your plans aim at them, and meals that fit get a tag.",
    Reel: GoalsReel,
    pro: { title: "Eat for your", highlight: "goals", subtitle: "Targets your meal plans aim at, with Pro." },
  },
};

const EASE = Easing.out(Easing.cubic);

// How many things Pro changes (the Free vs Pro rows that differ), for the
// "one of N" line: each sheet shows one feature, not all of Pro.
const PRO_FEATURE_COUNT = COMPARE_ROWS.filter((row) => row.free !== row.pro).length;

export type ProPageCopy = { title: string; highlight: string; subtitle: string };

type ProFeatureSheetProps = {
  feature: ProFeatureKey | null;
  onClose: () => void;
  /** "inline" when shown over another open sheet (Meal Details, cook mode). */
  presentation?: "modal" | "inline";
  /** Instead of opening the /pro route (e.g. Meal Details opens its own Pro
   *  page in the sheet): called once this sheet has closed, with the Pro
   *  page's title for this feature, or none for "See them all". */
  onOpenPro?: (copy?: ProPageCopy) => void;
  /** A quiet link under Not now (e.g. "Manage saved meals"), run once the
   *  sheet has closed. */
  secondary?: { label: string; onPress: () => void };
};

// A locked Pro feature (Settings → Pro features, and wherever someone runs
// into it: cook mode's narration, Meal Details' fiber/sugar/sodium, Price
// Watch's bell, the Meal Planner's locked days, the saved meals cap): a
// short looping reel of the feature working, what it is in a line, that
// it's one of several Pro features, and the way in (the Pro page, titled
// for it). One sheet for every feature so they feel like a set. Reduce
// motion: each reel's finished frame.
export function ProFeatureSheet({ feature, onClose, presentation, onOpenPro, secondary }: ProFeatureSheetProps) {
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const canTrial = useProStore((s) => Object.values(s.trialEligible).some(Boolean));
  // The last one stays on screen while the sheet slides away.
  const [shown, setShown] = useState<ProFeatureKey | null>(feature);
  useEffect(() => {
    if (feature) setShown(feature);
  }, [feature]);
  const open = !!feature;
  const f = shown ? FEATURES[shown] : null;
  const fade = (delay: number) => (reduceMotion ? FadeIn.duration(160) : FadeInDown.delay(delay).duration(320).easing(EASE));

  // What to do once the sheet has finished closing (navigating while it
  // slides away, or over another sheet, would stack badly).
  const after = useRef<(() => void) | null>(null);
  const closeThen = (action: () => void) => {
    after.current = action;
    onClose();
  };
  const goPro = (copy?: ProPageCopy) => {
    if (onOpenPro) return onOpenPro(copy);
    router.push({ pathname: "/pro", params: copy ? { ...copy, source: "feature" } : { source: "feature" } });
  };

  return (
    <BottomSheet
      visible={open}
      onClose={onClose}
      fitContent
      presentation={presentation}
      onClosed={() => {
        const action = after.current;
        after.current = null;
        action?.();
      }}
    >
      {f && (
        // The sheet already pads for the home indicator: only a little more
        // below Not now on such phones (it read as an empty band).
        <View className="gap-5 px-6 pt-3" style={{ paddingBottom: insets.bottom > 0 ? 4 : 24 }}>
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

          {/* It's one feature, not all of Pro: its own tinted strip, so it
              reads as news, with the way to the rest. */}
          <Animated.View entering={fade(190)}>
            <Pressable
              onPress={() => closeThen(() => goPro())}
              accessibilityRole="link"
              accessibilityLabel={`This is just one of ${PRO_FEATURE_COUNT} things Pro unlocks. See them all.`}
              className="flex-row items-center gap-3 rounded-2xl bg-accent/10 px-4 py-3 active:opacity-70"
            >
              <View className="h-8 w-8 items-center justify-center rounded-full bg-accent">
                <Sparkles color={colors.white} size={16} />
              </View>
              <Text className="flex-1 font-inter-regular text-body text-ink-emphasis">
                Just <Text className="font-inter-bold text-accent">1 of {PRO_FEATURE_COUNT}</Text> things Pro unlocks
              </Text>
              <View className="flex-row items-center">
                <Text className="font-inter-semibold text-small text-accent">See all</Text>
                <ChevronRight color={colors.accent} size={16} />
              </View>
            </Pressable>
          </Animated.View>

          <Animated.View entering={fade(240)} className="gap-3">
            <Button
              label={canTrial ? `Try Pro free for ${TRIAL_DAYS} days` : "Get Pro"}
              variant="secondary"
              onPress={() => closeThen(() => goPro(f.pro))}
            />
            <Pressable onPress={onClose} hitSlop={8} className="self-center active:opacity-60">
              <Text className="font-inter-semibold text-body text-ink-subtle">Not now</Text>
            </Pressable>
            {secondary && (
              <Pressable onPress={() => closeThen(secondary.onPress)} hitSlop={8} className="self-center active:opacity-60">
                <Text className="font-inter-semibold text-small text-primary">{secondary.label}</Text>
              </Pressable>
            )}
          </Animated.View>
        </View>
      )}
    </BottomSheet>
  );
}
