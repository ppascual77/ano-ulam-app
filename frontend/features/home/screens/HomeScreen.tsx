import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { Screen, SegmentedSwitch, usePageIntro, useStatusBarStrip } from "@/frontend/components/ui";
import { Header } from "@/frontend/features/home/components/Header";
import { PriceDropLine, useBiggestPriceDrop } from "@/frontend/features/home/components/PriceDropLine";
import { RandomMealPuller } from "@/frontend/features/home/components/RandomMealPuller";
import { HomePlanCard } from "@/frontend/features/home/components/HomePlanCard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeBackdrop, homeDarkEdgeTop } from "@/frontend/features/home/components/HomeBackdrop";
import { useSurpriseMeStore } from "@/frontend/core/preferences/store/useSurpriseMeStore";
import { BudgetSection } from "@/frontend/core/budget/components/BudgetSection";
import { PantrySection } from "@/frontend/core/pantry/components/PantrySection";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { HomeIntro } from "@/frontend/features/home/components/HomeIntro";
import { useDisplayName } from "@/frontend/features/auth/hooks/useDisplayName";
import { colors } from "@/frontend/constants/theme";

type Mode = "budget" | "pantry";

// How much further down the green reaches while the price line shows.
const PRICE_LINE_SPACE = 84;

// The status bar turns dark once the clock's line (half way down it) reaches
// the plan card's white half, about this far above the card's bottom.
const STATUS_BAR_FLIP_ABOVE_CARD = 110;
// Before the card's first layout (HomeBackdrop's guess for its bottom).
const STATUS_BAR_FLIP_FALLBACK = 350;

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "budget", label: "By Budget" },
  { value: "pantry", label: "By Pantry" },
];

export default function HomeScreen() {
  const [mode, setMode] = useState<Mode>("budget");
  // Signed in: "Hello, <first name>". A guest just gets "Hello".
  const { firstName } = useDisplayName();
  // Turned off in Settings > Home: no Surprise me tag at all.
  const showSurpriseMe = useSurpriseMeStore((s) => s.show);
  // Home's live line: this week's biggest DA price drop, when there is one.
  const priceDrop = useBiggestPriceDrop();
  const insets = useSafeAreaInsets();

  // The welcome intro plays once, right after onboarding (which lands here
  // with ?intro=1 and where its page indicator's dot was), not on every
  // visit like the other tabs' intros. Its dot lands as the period of
  // "Categories." (no confetti: that's kept for likes and saves).
  const params = useLocalSearchParams<{ intro?: string; dotX?: string; dotY?: string }>();
  const [introPending, setIntroPending] = useState(params.intro === "1");
  const reduceMotion = useReduceMotion();
  const intro = usePageIntro({ enabled: introPending && !reduceMotion });
  const entry =
    params.dotX && params.dotY ? { x: Number(params.dotX), y: Number(params.dotY) } : undefined;
  // Stable, so the memoized BudgetSection skips Home's other re-renders.
  const categoriesLanding = useMemo(() => ({ dotRef: intro.targetRef, showDot: intro.landed }), [intro.targetRef, intro.landed]);
  // Where the plan card ends, for where the status bar turns white.
  const [cardBottom, setCardBottom] = useState<number | null>(null);

  // A solid strip behind the status bar: dark green over the backdrop,
  // white once the plan card's white half reaches the clock. Dark clock
  // over the welcome intro's white.
  const statusBar = useStatusBarStrip({
    color: colors.home.top,
    darkUntil: (cardBottom ?? STATUS_BAR_FLIP_FALLBACK) - STATUS_BAR_FLIP_ABOVE_CARD,
    forceDark: intro.showing,
    // Clear while the textured green still fills it (no hard line under the
    // clock), fading in as the green's edge passes.
    clearUntil: homeDarkEdgeTop(insets.top, priceDrop ? PRICE_LINE_SPACE : 0),
  });

  const finishIntro = () => {
    intro.finish();
    setIntroPending(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    // No tap-to-dismiss wrapper: its touchable sat over the ScrollView and
    // claimed touches first, so a swipe started from rest (or a short one)
    // often didn't scroll. The ScrollView dismisses the keyboard instead
    // (the budget field), like the other tabs.
    // Unpadded so the backdrop runs edge to edge; the scroll content takes
    // Screen's usual padding instead. No top edge: the content scrolls under
    // the status bar, starting below it.
    <Screen edges={[]} padded={false} dismissKeyboardOnTap={false}>
      <ScrollView
        className="flex-1 bg-white"
        contentContainerClassName="px-5 pb-2"
        contentContainerStyle={{ paddingTop: statusBar.top + 8 }}
        onScroll={statusBar.onScroll}
        scrollEventThrottle={32}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <HomeBackdrop top={statusBar.top} extra={priceDrop ? PRICE_LINE_SPACE : 0} />
        <Header name={firstName}>{priceDrop && <PriceDropLine item={priceDrop} />}</Header>

        <View className="mt-5" onLayout={(e) => setCardBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
          <HomePlanCard />
        </View>

        <View className="mt-6 mb-4">
          {/* The shadow sits on a wrapper: the switch's own overflow-hidden
              would clip it on iOS. */}
          <View className="self-start rounded-full bg-white shadow-sm">
            <SegmentedSwitch size="lg" options={MODE_OPTIONS} value={mode} onChange={setMode} />
          </View>
        </View>
        {mode === "budget" ? (
          <BudgetSection categoriesLanding={categoriesLanding} />
        ) : (
          <PantrySection />
        )}
      </ScrollView>
      {statusBar.strip}
      {/* Below the status bar, where they sat before the page went under it. */}
      <View pointerEvents="box-none" style={{ position: "absolute", top: statusBar.top, left: 0, right: 0, bottom: 0 }}>
        {showSurpriseMe && <RandomMealPuller />}
        {intro.showing && (
          <HomeIntro key={intro.run} active={intro.active} targetRef={intro.targetRef} onDone={finishIntro} entry={entry} name={firstName} />
        )}
      </View>
    </Screen>
  );
}
