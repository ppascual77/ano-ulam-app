import { useEffect, useRef, useState } from "react";
import { ScrollView, View, useWindowDimensions, type ScrollViewInstance, type ViewInstance } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { Screen, SegmentedSwitch, isModalSheetOpen, usePageIntro, useStatusBarStrip } from "@/frontend/components/ui";
import { ModeSpotlight, type SpotlightRect } from "@/frontend/features/home/components/ModeSpotlight";
import { ModeSwitchLanding } from "@/frontend/features/home/components/ModeSwitchLanding";
import { Header } from "@/frontend/features/home/components/Header";
import { useBiggestPriceDrop } from "@/frontend/features/home/components/PriceDropLine";
import { HomeTicker } from "@/frontend/features/home/components/HomeTicker";
import { useCleanupNote } from "@/frontend/core/pantry/hooks/useCleanupNote";
import { RandomMealPuller } from "@/frontend/features/home/components/RandomMealPuller";
import { HomePlanCard } from "@/frontend/features/home/components/HomePlanCard";
import { useFirstRun } from "@/frontend/core/preferences/store/useFirstRunStore";
import { PantryNudgeSheet } from "@/frontend/features/home/components/PantryNudgeSheet";
import { usePlanDayCleanup } from "@/frontend/features/home/hooks/usePlanDayCleanup";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeBackdrop, homeDarkEdgeTop } from "@/frontend/features/home/components/HomeBackdrop";
import { useSurpriseMeStore } from "@/frontend/core/preferences/store/useSurpriseMeStore";
import { BudgetSection } from "@/frontend/core/budget/components/BudgetSection";
import { PantrySection } from "@/frontend/core/pantry/components/PantrySection";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { HomeIntro } from "@/frontend/features/home/components/HomeIntro";
import { useDisplayName } from "@/frontend/features/auth/hooks/useDisplayName";
import { colors } from "@/frontend/constants/theme";
import { useTabBarStore } from "@/frontend/components/navigation/useTabBarStore";

type Mode = "budget" | "pantry";

// After the welcome intro's dot lands: the switch's highlight, then (once
// its lap has run and faded) the mode spotlight.
const HIGHLIGHT_AFTER_INTRO_MS = 350;
const SPOTLIGHT_DELAY_MS = 2000;

// How much further down the green reaches while the header line shows.
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
  // ...taking turns with what a finished plan day took out of the pantry.
  const cleanupNote = useCleanupNote();
  const hasLine = !!priceDrop || !!cleanupNote;
  // Fresh from onboarding: the budget picked there (Home's form is filled
  // and suggested, see BudgetSection), and the one-time mode spotlight.
  const firstRun = useFirstRun();
  const insets = useSafeAreaInsets();

  // The welcome intro plays once, right after onboarding (which lands here
  // with ?intro=1 and where its page indicator's dot was), not on every
  // visit like the other tabs' intros. Its dot lands in the middle of the
  // By Budget / By Pantry switch (no confetti: that's kept for likes and
  // saves).
  const params = useLocalSearchParams<{ intro?: string; dotX?: string; dotY?: string }>();
  const [introPending, setIntroPending] = useState(params.intro === "1");
  const reduceMotion = useReduceMotion();
  const intro = usePageIntro({ enabled: introPending && !reduceMotion });
  // The bottom nav stays hidden (onboarding hid it) until the welcome intro
  // is over, so it doesn't peek out under the intro's cover.
  useEffect(() => {
    useTabBarStore.getState().setHidden(intro.showing);
  }, [intro.showing]);
  // Meal plan days that have ended tidy the pantry (a note with Undo), once
  // Home is past its welcome intro.
  usePlanDayCleanup(!introPending && !intro.showing);
  const entry =
    params.dotX && params.dotY ? { x: Number(params.dotX), y: Number(params.dotY) } : undefined;
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
    clearUntil: homeDarkEdgeTop(insets.top, hasLine ? PRICE_LINE_SPACE : 0),
  });

  // Once, for someone new, right after the welcome intro: a spotlight on By
  // Budget / By Pantry (ModeSpotlight). Home scrolls the switch into view
  // first, then the cutout is measured where it landed.
  const scrollRef = useRef<ScrollViewInstance>(null);
  const switchRef = useRef<ViewInstance>(null);
  const switchY = useRef(0);
  const { height: screenHeight } = useWindowDimensions();
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const spotlightAsked = useRef(false);
  const spotlightDue = !introPending && !intro.showing && firstRun.loaded && firstRun.onboarded && !firstRun.modeTourShown;
  useEffect(() => {
    if (!spotlightDue || spotlightAsked.current) return;
    let timer: ReturnType<typeof setTimeout>;
    const start = () => {
      timer = setTimeout(() => {
        // Never over a sheet: try again once it's closed.
        if (isModalSheetOpen()) return start();
        spotlightAsked.current = true;
        scrollRef.current?.scrollTo({ y: Math.max(switchY.current - screenHeight * 0.3, 0), animated: !reduceMotion });
        timer = setTimeout(
          () =>
            switchRef.current?.measureInWindow((x, y, width, height) => {
              if (width === 0) return;
              useTabBarStore.getState().setHidden(true);
              setSpotlight({ x, y, width, height });
            }),
          reduceMotion ? 80 : 450,
        );
      }, SPOTLIGHT_DELAY_MS);
    };
    start();
    return () => clearTimeout(timer);
  }, [spotlightDue]);
  const closeSpotlight = () => {
    setSpotlight(null);
    useTabBarStore.getState().setHidden(false);
    firstRun.markModeTourShown();
  };

  // The switch takes in the intro's dot: a swell with an orange wash, then a
  // lap of its border (ModeSwitchLanding), like Discover's Create button.
  const [switchHighlight, setSwitchHighlight] = useState(0);
  const finishIntro = () => {
    intro.finish();
    setIntroPending(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // A beat after the intro's layer has gone, so it plays in the open.
    setTimeout(() => setSwitchHighlight((n) => n + 1), HIGHLIGHT_AFTER_INTRO_MS);
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
        ref={scrollRef}
        className="flex-1 bg-white"
        contentContainerClassName="px-5 pb-2"
        contentContainerStyle={{ paddingTop: statusBar.top + 8 }}
        onScroll={statusBar.onScroll}
        scrollEventThrottle={32}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <HomeBackdrop top={statusBar.top} extra={hasLine ? PRICE_LINE_SPACE : 0} />
        <Header name={firstName}>{hasLine && <HomeTicker priceDrop={priceDrop} />}</Header>

        <View className="mt-5" onLayout={(e) => setCardBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
          <HomePlanCard />
        </View>

        <View className="mt-6 mb-4" onLayout={(e) => (switchY.current = e.nativeEvent.layout.y)}>
          {/* The shadow sits on a wrapper: the switch's own overflow-hidden
              would clip it on iOS. */}
          <View ref={switchRef} collapsable={false} className="self-start rounded-full bg-white shadow-sm">
            <ModeSwitchLanding landingRef={intro.targetRef} highlightId={switchHighlight}>
              <SegmentedSwitch size="lg" options={MODE_OPTIONS} value={mode} onChange={setMode} />
            </ModeSwitchLanding>
          </View>
        </View>
        {mode === "budget" ? (
          <BudgetSection />
        ) : (
          // Room above the bottom nav so the last ingredients aren't tucked
          // against it (Home only; Profile's Pantry tab has its own).
          <View className="pb-12">
            <PantrySection />
          </View>
        )}
      </ScrollView>
      {statusBar.strip}
      {/* Yesterday's planned meals: "Cooked any of these?" (only when
          there's something to ask, once a day; not over the welcome intro). */}
      <PantryNudgeSheet enabled={!introPending && !intro.showing} />
      {/* Below the status bar, where they sat before the page went under it. */}
      <View pointerEvents="box-none" style={{ position: "absolute", top: statusBar.top, left: 0, right: 0, bottom: 0 }}>
        {showSurpriseMe && <RandomMealPuller />}
        {intro.showing && (
          <HomeIntro key={intro.run} active={intro.active} targetRef={intro.targetRef} onDone={finishIntro} entry={entry} name={firstName} />
        )}
      </View>
      {spotlight && <ModeSpotlight rect={spotlight} onDone={closeSpotlight} />}
    </Screen>
  );
}
