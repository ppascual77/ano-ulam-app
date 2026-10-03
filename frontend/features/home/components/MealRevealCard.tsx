import { ReactNode, useEffect, useState } from "react";
import { Modal, Pressable, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { ChevronRight } from "lucide-react-native";
import { AppText, Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MacroBreakdown } from "@/frontend/core/meals/components/card/MacroBreakdown";
import { MealInfoPill } from "@/frontend/core/meals/components/MealInfoPill";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import type { MealType } from "@/frontend/core/meals/mealTypes";

const REVEAL_MS = 1100;
const EXIT_MS = 220;
// Starts face down (180°) and spins 1.5 turns to land face up (720°).
const START_DEG = 180;
const END_DEG = 720;
const START_SCALE = 0.15;
// Card height as a share of the screen; width follows a card-like ratio.
const HEIGHT_SHARE = 0.6;
const ASPECT = 0.68;

type MealRevealCardProps = {
  /** null hides the card (with a short fade). */
  meal: MealType | null;
  /** Fires the moment the card lands face up (confetti time). */
  onLanded?: () => void;
  onViewDetails: (meal: MealType) => void;
  onDismiss: () => void;
  /** Rendered above the card (the confetti). */
  overlay?: ReactNode;
};

// "Surprise me" reveal: a small face-down card (green back, white logo)
// zooms in while flipping and lands face up showing the picked meal.
export function MealRevealCard({ meal, onLanded, onViewDetails, onDismiss, overlay }: MealRevealCardProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const cardHeight = screenHeight * HEIGHT_SHARE;
  const cardWidth = Math.min(screenWidth * 0.85, cardHeight * ASPECT);

  // Keep the last meal rendered while fading out.
  const [shown, setShown] = useState<MealType | null>(meal);
  const progress = useSharedValue(0);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (meal) {
      setShown(meal);
      progress.value = 0;
      backdrop.value = withTiming(1, { duration: 250 });
      progress.value = withTiming(1, { duration: REVEAL_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished && onLanded) scheduleOnRN(onLanded);
      });
    } else if (shown) {
      backdrop.value = withTiming(0, { duration: EXIT_MS }, (finished) => {
        if (finished) scheduleOnRN(setShown, null);
      });
    }
    // Only when the meal changes.
  }, [meal]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [START_SCALE, 1]) }],
  }));
  const angle = () => {
    "worklet";
    return interpolate(progress.value, [0, 1], [START_DEG, END_DEG]);
  };
  // Each face is visible only while it faces the viewer (the opacity backs
  // up backfaceVisibility, which Android doesn't always honor).
  const frontStyle = useAnimatedStyle(() => {
    const deg = angle();
    return {
      opacity: Math.cos((deg * Math.PI) / 180) > 0 ? 1 : 0,
      transform: [{ perspective: 1200 }, { rotateY: `${deg}deg` }],
    };
  });
  const backStyle = useAnimatedStyle(() => {
    const deg = angle() + 180;
    return {
      opacity: Math.cos((deg * Math.PI) / 180) > 0 ? 1 : 0,
      transform: [{ perspective: 1200 }, { rotateY: `${deg}deg` }],
    };
  });
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  if (!shown) return null;
  const face = { width: cardWidth, height: cardHeight, backfaceVisibility: "hidden" as const };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
      <Animated.View style={backdropStyle} className="absolute inset-0 bg-ink-emphasis/60">
        <Pressable className="flex-1" onPress={onDismiss} accessibilityLabel="Close" />
      </Animated.View>

      <View pointerEvents="box-none" className="flex-1 items-center justify-center">
        <Animated.View style={[{ width: cardWidth, height: cardHeight }, cardStyle]}>
          {/* Back: green with the white logo. */}
          <Animated.View
            style={[face, backStyle]}
            className="absolute items-center justify-center rounded-3xl bg-primary shadow-lg"
          >
            <Image
              source={require("@/assets/icons/logo_white.png")}
              style={{ width: cardWidth * 0.4, height: cardWidth * 0.4 * (374 / 255) }}
              contentFit="contain"
            />
          </Animated.View>

          {/* Front: the picked meal. */}
          <Animated.View style={[face, frontStyle]} className="absolute overflow-hidden rounded-3xl bg-white shadow-lg">
            <View style={{ height: cardHeight * 0.5 }}>
              <Image source={resolveMealImage(shown)} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              <View className="absolute bottom-2 left-2">
                <MealInfoPill meal={shown} />
              </View>
            </View>
            <View className="flex-1 justify-between px-5 pb-5 pt-4">
              <View>
                <AppText variant="title" numberOfLines={2} className="text-ink-emphasis">
                  {shown.name}
                </AppText>
                <AppText variant="title" className="mt-1 font-inter-semibold text-primary">
                  ₱{shown.price}
                  {shown.buffer_price ? ` – ₱${shown.buffer_price}` : ""}
                </AppText>
                <MacroBreakdown
                  macros={{ calories: shown.calories, protein: shown.protein, carbs: shown.carbs, fats: shown.fats }}
                />
              </View>
              <Button
                label="View Details"
                variant="tinted"
                icon={<ChevronRight color={colors.primary} size={16} />}
                iconPosition="right"
                onPress={() => onViewDetails(shown)}
              />
            </View>
          </Animated.View>
        </Animated.View>
      </View>

      {overlay}
    </Modal>
  );
}
