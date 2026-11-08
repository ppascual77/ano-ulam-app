import { type ReactNode, useEffect } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { Check } from "lucide-react-native";
import { EarnProNote } from "@/frontend/core/pro/components/EarnProNote";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { AppText } from "@/frontend/components/ui";
import { SignInButtons } from "@/frontend/features/auth/components/SignInButtons";
import type { SignInProvider } from "@/frontend/features/auth/hooks/useAuth";
import { TermsLine } from "@/frontend/features/auth/components/TermsLine";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import type { AccountPitchSlideData } from "../slides";
import { HighlightedText } from "./HighlightedText";
import { HeroTitle } from "./HeroTitle";

const RISE_MS = 520;
const RISE_DISTANCE = 16;
const RISE_EASING = Easing.out(Easing.cubic);

type Props = {
  slide: AccountPitchSlideData;
  width: number;
  /** True once the carousel has settled on this slide. */
  active: boolean;
  onSignIn: (provider: SignInProvider) => void;
  onContinueWithoutAccount: () => void;
  isSigningIn: boolean;
};

// The closing pitch, top to bottom by weight: art, title and one line of why;
// the benefits grouped in one quiet card; then the actions pinned to the
// bottom in liquid glass, sitting over the flowing blob so it shows through.
// The actions rise in once the slide settles (the first time only), so the
// eye lands on the pitch first and the buttons arrive as the next step.
export function AccountPitchSlide({ slide, width, active, onSignIn, onContinueWithoutAccount, isSigningIn }: Props) {
  return (
    <View style={{ width }} className="flex-1 px-8">
      {/* The pitch centers in whatever height the actions leave, so the
          space splits evenly above and below it instead of pooling in one
          gap over the buttons. */}
      <View className="flex-1 items-center justify-center">
        {slide.image && <Image source={slide.image} style={{ width: 180, height: 180 }} contentFit="contain" />}

        <HeroTitle segments={slide.hero} className="mt-4 text-center text-heading" />
        <HighlightedText className="mt-2 text-center">{slide.subtitle}</HighlightedText>

        <View className="mt-8 w-full gap-3.5 rounded-2xl border border-ink-emphasis/10 bg-white px-5 py-5">
          {slide.benefits.map((benefit) => (
            <View key={benefit} className="flex-row items-center gap-3">
              <View className="h-5 w-5 items-center justify-center rounded-full bg-primary">
                <Check color={colors.white} size={12} strokeWidth={3} />
              </View>
              <AppText variant="body" className="flex-1">
                {benefit}
              </AppText>
            </View>
          ))}
          {/* Pro rewards, set apart under a rule. */}
          <View className="border-t border-ink-emphasis/10 pt-3.5">
            <EarnProNote />
          </View>
        </View>
      </View>

      {/* Three tiers, each with its own room: the two sign-in buttons, the
          skip as a quiet text button with a real tap target, then the legal
          line set apart at the bottom in a narrower, balanced block. */}
      <Rise active={active}>
        <SignInButtons variant="glass" onSignIn={onSignIn} signingIn={isSigningIn} />
        <AppText variant="body" className="mt-2 py-3 text-center text-primary" onPress={onContinueWithoutAccount}>
          Continue without an account
        </AppText>
        <View className="mt-4 max-w-[290px] self-center">
          <TermsLine />
        </View>
      </Rise>
    </View>
  );
}

// Fades and lifts its children in the first time `active` turns true.
// Reduce motion: a plain fade, no travel.
function Rise({ active, children }: { active: boolean; children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (active && progress.value === 0) {
      progress.value = withDelay(120, withTiming(1, { duration: reduceMotion ? 250 : RISE_MS, easing: RISE_EASING }));
    }
  }, [active, progress, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - progress.value) * RISE_DISTANCE }],
  }));

  return (
    <Animated.View style={style} pointerEvents={active ? "auto" : "none"} className="pb-2">
      {children}
    </Animated.View>
  );
}
