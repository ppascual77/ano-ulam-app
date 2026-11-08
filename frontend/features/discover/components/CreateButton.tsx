import type { RefObject } from "react";
import { Platform, Pressable, StyleSheet, View, type ViewInstance } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Plus } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { FEED_TABS_HEIGHT } from "./FeedTabs";

const LIQUID_GLASS = isLiquidGlassAvailable();
const SIZE = FEED_TABS_HEIGHT;
const CIRCLE = { borderRadius: SIZE / 2 };
// The intro's dot shrinks to this as it lands in the +.
const LANDING_DOT = 4;

// dark: liquid glass over the Recipes reel, like the tabs beside it. light:
// solid brand green on Community.
const variants = {
  dark: LIQUID_GLASS ? "border border-white/25" : Platform.OS === "ios" ? "border border-white/25 bg-black/20" : "border border-white/25 bg-black/45",
  light: "bg-brand-green",
} as const;

type CreateButtonProps = {
  onPress: () => void;
  variant: keyof typeof variants;
  /** An invisible spot at the +'s center: where Discover's intro dot lands
   *  (see usePageIntro's targetRef). */
  landingRef?: RefObject<ViewInstance | null>;
};

// Discover's Create: a plain + circle the tabs' height, so the two line up.
// One tap opens the Create sheet (the screen owns that).
export function CreateButton({ onPress, variant, landingRef }: CreateButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Create"
      style={[{ width: SIZE, height: SIZE }, CIRCLE]}
      className={`items-center justify-center overflow-hidden active:opacity-80 ${variants[variant]}`}
    >
      {variant === "dark" && LIQUID_GLASS && <GlassView glassEffectStyle="clear" style={[StyleSheet.absoluteFill, CIRCLE]} />}
      {variant === "dark" && !LIQUID_GLASS && Platform.OS === "ios" && (
        <BlurView intensity={25} tint="dark" pointerEvents="none" style={[StyleSheet.absoluteFill, CIRCLE]} />
      )}
      <Plus color={colors.white} size={20} strokeWidth={2.2} />
      {landingRef && (
        <View
          ref={landingRef}
          collapsable={false}
          pointerEvents="none"
          style={{ position: "absolute", width: LANDING_DOT, height: LANDING_DOT }}
        />
      )}
    </Pressable>
  );
}
