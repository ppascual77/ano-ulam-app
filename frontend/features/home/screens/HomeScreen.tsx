import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { Screen, SegmentedSwitch, usePageIntro } from "@/frontend/components/ui";
import { Header } from "@/frontend/features/home/components/Header";
import { RandomMealPuller } from "@/frontend/features/home/components/RandomMealPuller";
import { PlanWeekCard } from "@/frontend/features/home/components/PlanWeekCard";
import { useSurpriseMeStore } from "@/frontend/core/preferences/store/useSurpriseMeStore";
import { BudgetSection } from "@/frontend/core/budget/components/BudgetSection";
import { PantrySection } from "@/frontend/core/pantry/components/PantrySection";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { HomeIntro } from "@/frontend/features/home/components/HomeIntro";

type Mode = "budget" | "pantry";

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "budget", label: "By Budget" },
  { value: "pantry", label: "By Pantry" },
];

export default function HomeScreen() {
  const [mode, setMode] = useState<Mode>("budget");
  // Turned off in Settings > Home: no Surprise me tag at all.
  const showSurpriseMe = useSurpriseMeStore((s) => s.show);

  // The welcome intro plays once, right after onboarding (which lands here
  // with ?intro=1 and where its page indicator's dot was), not on every
  // visit like the other tabs' intros. Its dot lands as the period of
  // "Categories." with a burst of confetti.
  const params = useLocalSearchParams<{ intro?: string; dotX?: string; dotY?: string }>();
  const [introPending, setIntroPending] = useState(params.intro === "1");
  const reduceMotion = useReduceMotion();
  const intro = usePageIntro({ enabled: introPending && !reduceMotion });
  const [landingBurst, setLandingBurst] = useState(0);
  const entry =
    params.dotX && params.dotY ? { x: Number(params.dotX), y: Number(params.dotY) } : undefined;
  const finishIntro = () => {
    intro.finish();
    setIntroPending(false);
    setLandingBurst((n) => n + 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    // No tap-to-dismiss wrapper: its touchable sat over the ScrollView and
    // claimed touches first, so a swipe started from rest (or a short one)
    // often didn't scroll. The ScrollView dismisses the keyboard instead
    // (the budget field), like the other tabs.
    <Screen edges={["top"]} dismissKeyboardOnTap={false}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* TODO: "Patrick" is a placeholder — replace with the authenticated
            user's first name once auth/profile data is wired up. */}
        <Header name="Patrick" />

        <View className="mt-5">
          <PlanWeekCard />
        </View>

        <View className="mt-6 mb-4">
          <SegmentedSwitch size="lg" options={MODE_OPTIONS} value={mode} onChange={setMode} />
        </View>
        {mode === "budget" ? (
          <BudgetSection
            categoriesLanding={{ dotRef: intro.targetRef, showDot: intro.landed, burstId: landingBurst }}
          />
        ) : (
          <PantrySection />
        )}
      </ScrollView>
      {showSurpriseMe && <RandomMealPuller />}
      {intro.showing && (
        <HomeIntro key={intro.run} active={intro.active} targetRef={intro.targetRef} onDone={finishIntro} entry={entry} />
      )}
    </Screen>
  );
}
