import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  View,
  Pressable,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
  type ViewInstance,
} from "react-native";
import { router } from "expo-router";
import { Text } from "@/frontend/components/ui/Text";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { CarouselIndicator } from "@/frontend/components/ui";
import { ContentSlide } from "../components/ContentSlide";
import { PreferencesSlide } from "../components/PreferencesSlide";
import { PreferenceGroupsSlide } from "../components/PreferenceGroupsSlide";
import { AccountPitchSlide } from "../components/AccountPitchSlide";
import { NumbersExplainerSheet } from "../components/NumbersExplainerSheet";
import { FlyingDot, PeriodDot, type DotPoint } from "../components/NumbersDot";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { RotatingBlob, type RotatingBlobHandle } from "../components/RotatingBlob";
import { setDotRevealTarget, useDotRevealArriving } from "../components/DotReveal";
import { onboardingSlides, type OnboardingSlideData, type PreferencesSlideData } from "../slides";
import { type SignInProvider, useSignIn } from "@/frontend/features/auth/hooks/useAuth";
import { useAuthActivityStore } from "@/frontend/features/auth/store/useAuthActivityStore";
import { useUpdateUserProfile } from "@/frontend/features/auth/hooks/useUserProfile";
import { useOnboardingStore } from "@/frontend/core/preferences/store/useOnboardingStore";
import { useTabBarStore } from "@/frontend/components/navigation/useTabBarStore";

const preferencesSlide = onboardingSlides.find(
  (s) => s.type === "preferences",
) as PreferencesSlideData | undefined;
const defaultGoals = new Set(
  preferencesSlide?.options.filter((o) => o.defaultSelected).map((o) => o.id) ?? [],
);

type SlideCallbacks = {
  goals: Set<string>;
  onToggleGoal: (id: string) => void;
  groupSelections: Record<string, string[]>;
  onGroupChange: (groupId: string, value: string[]) => void;
  onSignIn: (provider: SignInProvider) => void;
  onContinueWithoutAccount: () => void;
  isSigningIn: boolean;
  /** The carousel has settled on the closing account pitch. */
  accountActive: boolean;
  onOpenNumbers: () => void;
  /** The explainer slide's title period, where "Got it"'s dot lands. */
  numbersPeriod: ReactNode;
};

function renderSlide(slide: OnboardingSlideData, width: number, callbacks: SlideCallbacks) {
  switch (slide.type) {
    case "preferences":
      return (
        <PreferencesSlide
          key={slide.id}
          slide={slide}
          width={width}
          selected={callbacks.goals}
          onToggle={callbacks.onToggleGoal}
        />
      );
    case "preferenceGroups":
      return (
        <PreferenceGroupsSlide
          key={slide.id}
          slide={slide}
          width={width}
          selections={callbacks.groupSelections}
          onGroupChange={callbacks.onGroupChange}
        />
      );
    case "accountPitch":
      return (
        <AccountPitchSlide
          key={slide.id}
          slide={slide}
          width={width}
          active={callbacks.accountActive}
          onSignIn={callbacks.onSignIn}
          onContinueWithoutAccount={callbacks.onContinueWithoutAccount}
          isSigningIn={callbacks.isSigningIn}
        />
      );
    case "content":
      return (
        <ContentSlide
          key={slide.id}
          slide={slide}
          width={width}
          onLinkPress={slide.link === "numbers" ? callbacks.onOpenNumbers : undefined}
          period={slide.link === "numbers" ? callbacks.numbersPeriod : undefined}
        />
      );
  }
}

// The "how it works" slides only: Settings' tour (no preferences or
// sign-in, which Settings already covers and replaying could overwrite).
const tourSlides = onboardingSlides.filter((s) => s.type === "content");

type OnboardingScreenProps = {
  /** Settings' "How AnoUlam works": the content slides only, with Skip
   *  (Done on the last slide) to go back. Doesn't mark onboarding done or
   *  save anything. */
  tour?: boolean;
};

export default function OnboardingScreen({ tour = false }: OnboardingScreenProps) {
  const slides = tour ? tourSlides : onboardingSlides;
  const { width } = useWindowDimensions();
  const topBlobRef = useRef<RotatingBlobHandle>(null);
  const bottomBlobRef = useRef<RotatingBlobHandle>(null);
  const indicatorDotRef = useRef<ViewInstance>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === slides.length - 1;

  const [goals, setGoals] = useState<Set<string>>(() => new Set(defaultGoals));
  const [groupSelections, setGroupSelections] = useState<Record<string, string[]>>({});
  // Slide 4's "Where do our numbers come from?" sheet.
  const [numbersOpen, setNumbersOpen] = useState(false);
  // "Got it" shrinks to an orange dot that's tossed back up to the slide
  // title and lands as its period, with a little pulse. The period stays
  // empty while the dot is in the air.
  const reduceMotion = useReduceMotion();
  const numbersDotRef = useRef<ViewInstance>(null);
  const [numbersFlight, setNumbersFlight] = useState<DotPoint | null>(null);
  const [numbersPulse, setNumbersPulse] = useState(0);

  // Arriving from Get Started: its orange dot is shrinking onto the
  // indicator (DotReveal), so the marker stays hidden until it lands.
  const arriving = useDotRevealArriving();
  useEffect(() => {
    if (arriving) setDotRevealTarget(indicatorDotRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The "signing you in" screen stays up through saving the preferences.
  const signIn = useSignIn({ holdOverlay: true });
  const updateProfile = useUpdateUserProfile();

  // Fires the blob speed-boost partway through a slide transition (tap or
  // swipe) rather than waiting for it to fully settle, so it lands closer
  // to the tail end of the motion instead of right after it stops.
  const scrollStartOffsetRef = useRef(0);
  const hasPulsedRef = useRef(false);
  const PULSE_TRIGGER_FRACTION = 0.7;

  const pulseBlobs = () => {
    topBlobRef.current?.pulse();
    bottomBlobRef.current?.pulse();
  };

  const toggleGoal = (id: string) => {
    setGoals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleGroupChange = (groupId: string, value: string[]) => {
    setGroupSelections((prev) => ({ ...prev, [groupId]: value }));
  };

  // Off to Home's welcome intro, which picks the indicator's dot up from
  // exactly where it is now (Home fades in over this screen, see
  // app/_layout.tsx) and hops it into "Hey, welcome!".
  const goHome = () => {
    // Once per phone: from now on the app opens straight to Home.
    useOnboardingStore.getState().markDone();
    // No bottom nav under Home's welcome intro (Home shows it again after).
    useTabBarStore.getState().setHidden(true);
    const dot = indicatorDotRef.current;
    if (!dot) {
      router.replace({ pathname: "/home", params: { intro: "1" } });
      return;
    }
    dot.measureInWindow((x, y, w, h) => {
      router.replace({
        pathname: "/home",
        params: { intro: "1", dotX: String(x + w / 2), dotY: String(y + h / 2) },
      });
    });
  };

  const handleSignIn = async (provider: SignInProvider) => {
    try {
      const session = await signIn.mutateAsync(provider);
      if (!session) return; // user cancelled the browser flow
      await updateProfile.mutateAsync({
        preferences: {
          // Nothing picked on the slide: no focus, no allergens.
          dietary_focus: groupSelections["dietary-focus"]?.[0] ?? "none",
          allergens: groupSelections["allergens"] ?? [],
          goals: Array.from(goals),
        },
      });
      goHome();
    } catch (err) {
      console.error("Sign-in failed", err);
    } finally {
      // Fades out as Home fades in.
      useAuthActivityStore.getState().setActivity(null);
    }
  };

  const handleScrollBeginDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollStartOffsetRef.current = e.nativeEvent.contentOffset.x;
    hasPulsedRef.current = false;
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (hasPulsedRef.current) return;
    const distanceTraveled = Math.abs(
      e.nativeEvent.contentOffset.x - scrollStartOffsetRef.current,
    );
    if (distanceTraveled > width * PULSE_TRIGGER_FRACTION) {
      hasPulsedRef.current = true;
      pulseBlobs();
    }
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={{ flex: 1 }} className="bg-white">
      <View className="absolute inset-0">
        <RotatingBlob
          ref={topBlobRef}
          source={require("@/assets/onboarding/blob-bg/circular-blob.png")}
          aspectRatio={1800 / 1755}
          top="-110%"
          height={2000}
        />
        <RotatingBlob
          ref={bottomBlobRef}
          source={require("@/assets/onboarding/blob-bg/circular-blob.png")}
          aspectRatio={1800 / 1755}
          bottom="-110%"
          height={2000}
        />
      </View>
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleScrollEnd}
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {slides.map((slide) =>
            renderSlide(slide, width, {
              goals,
              onToggleGoal: toggleGoal,
              groupSelections,
              onGroupChange: handleGroupChange,
              onSignIn: handleSignIn,
              onContinueWithoutAccount: goHome,
              isSigningIn: signIn.isPending,
              accountActive: isLast,
              onOpenNumbers: () => setNumbersOpen(true),
              numbersPeriod: <PeriodDot dotRef={numbersDotRef} hidden={!!numbersFlight} pulse={numbersPulse} />,
            }),
          )}
        </ScrollView>

        {/* No next button: the slides are swiped (the indicator shows
            where you are), and the last one has its own actions. */}
        {/* The tour from Settings: its way out sits beside the dots, under
            the thumb (Skip while swiping, a Done button on the last slide). */}
        <View className={`flex-row items-center justify-between px-10 mb-6 ${tour ? "min-h-12" : "h-8"}`}>
          {/* The flat accent pill squeezes into a ball, hops to the next
              page and flattens out again. */}
          <CarouselIndicator
            variant="hop"
            hopRest="pill"
            total={slides.length}
            activeIndex={index}
            hopMarkerRef={indicatorDotRef}
            hopMarkerHidden={arriving}
          />
          {tour &&
            (isLast ? (
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                className="rounded-full bg-primary px-6 py-2.5 active:opacity-80"
              >
                <Text className="font-inter-semibold text-body text-white">Done</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12} className="py-2 active:opacity-60">
                <Text className="font-inter-semibold text-body text-ink-subtle">Skip</Text>
              </Pressable>
            ))}
        </View>
      </SafeAreaView>

      <NumbersExplainerSheet
        visible={numbersOpen}
        onClose={() => setNumbersOpen(false)}
        onGotIt={(from) => {
          setNumbersOpen(false);
          if (from) setNumbersFlight(from);
        }}
        reduceMotion={reduceMotion}
      />
      {numbersFlight && (
        <FlyingDot
          from={numbersFlight}
          targetRef={numbersDotRef}
          onLand={() => {
            setNumbersFlight(null);
            setNumbersPulse((n) => n + 1);
          }}
        />
      )}
    </View>
  );
}
