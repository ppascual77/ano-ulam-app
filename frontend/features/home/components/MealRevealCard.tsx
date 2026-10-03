import { ReactNode, useEffect, useState } from "react";
import { Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import type { MealType } from "@/frontend/core/meals/mealTypes";

// Zoom and spin share one timeline. A gentle in-out curve keeps the spin
// readable: the card turns visibly while it grows, then settles face up.
const REVEAL_MS = 1600;
const EXIT_MS = 220;
// Starts face down (180°) and lands face up: END_DEG must be a multiple
// of 360 (front facing). 1080 = 2.5 turns.
const START_DEG = 180;
const END_DEG = 1080;
const START_SCALE = 0.15;
// Strong perspective so the turn reads as 3D, not a squash.
const PERSPECTIVE = 800;
// Card height as a share of the screen; width follows a card-like ratio.
const HEIGHT_SHARE = 0.6;
const ASPECT = 0.68;
// Dark fade up from the bottom, so the white name and price read on any photo.
const TEXT_SCRIM = ["rgba(0,0,0,0)", "rgba(0,0,0,0.45)", "rgba(0,0,0,0.85)"] as const;

type MealRevealCardProps = {
  /** null hides the card (with a short fade). */
  meal: MealType | null;
  /** Fires the moment the card lands face up (confetti time). */
  onLanded?: () => void;
  /** Tapping the face-up card. */
  onViewDetails: (meal: MealType) => void;
  onDismiss: () => void;
  /** Rendered above the card (the confetti). */
  overlay?: ReactNode;
};

// "Surprise me" reveal: a small face-down card (green back, white logo)
// zooms in while flipping and lands face up showing the picked meal: its
// photo with the name and price over a dark fade. Tap it for details.
export function MealRevealCard({ meal, onLanded, onViewDetails, onDismiss, overlay }: MealRevealCardProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const cardHeight = screenHeight * HEIGHT_SHARE;
  const cardWidth = Math.min(screenWidth * 0.85, cardHeight * ASPECT);

  // Keep the last meal rendered while fading out.
  const [shown, setShown] = useState<MealType | null>(meal);
  const progress = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (meal) {
      setShown(meal);
      progress.value = 0;
      fade.value = withTiming(1, { duration: 250 });
      progress.value = withTiming(1, { duration: REVEAL_MS, easing: Easing.inOut(Easing.quad) }, (finished) => {
        if (finished && onLanded) scheduleOnRN(onLanded);
      });
    } else if (shown) {
      fade.value = withTiming(0, { duration: EXIT_MS }, (finished) => {
        if (finished) scheduleOnRN(setShown, null);
      });
    }
    // Only when the meal changes.
  }, [meal]);

  // The whole card turns (one rotating element); the faces are static.
  // Which face shows is decided from the angle alone. backfaceVisibility
  // can't be used: React Native flattens each view before the parent's 3D
  // turn, so the back's own 180° pre-turn would always count as facing away
  // and it would never show. The pre-turn still mirrors the back so the
  // logo reads the right way round when the card turns it toward you.
  const cardStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [
      { perspective: PERSPECTIVE },
      { scale: interpolate(progress.value, [0, 1], [START_SCALE, 1]) },
      { rotateY: `${interpolate(progress.value, [0, 1], [START_DEG, END_DEG])}deg` },
    ],
  }));
  const frontStyle = useAnimatedStyle(() => {
    const deg = interpolate(progress.value, [0, 1], [START_DEG, END_DEG]);
    return { opacity: Math.cos((deg * Math.PI) / 180) > 0 ? 1 : 0 };
  });
  const backStyle = useAnimatedStyle(() => {
    const deg = interpolate(progress.value, [0, 1], [START_DEG, END_DEG]);
    return { opacity: Math.cos((deg * Math.PI) / 180) > 0 ? 0 : 1 };
  });
  const backdropStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (!shown) return null;
  // No drop shadow on the faces: edge-on mid-spin it smears into a gray
  // flicker beside the card. The dimmed backdrop gives enough contrast.
  const face = { width: cardWidth, height: cardHeight };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
      <Animated.View style={backdropStyle} className="absolute inset-0 bg-ink-emphasis/60">
        <Pressable className="flex-1" onPress={onDismiss} accessibilityLabel="Close" />
      </Animated.View>

      <View pointerEvents="box-none" className="flex-1 items-center justify-center">
        <Animated.View style={[{ width: cardWidth, height: cardHeight }, cardStyle]}>
          {/* Back: green with the white logo, pre-turned to face away. */}
          <Animated.View
            style={[face, { transform: [{ rotateY: "180deg" }] }, backStyle]}
            className="absolute items-center justify-center rounded-3xl bg-primary"
          >
            <Image
              source={require("@/assets/icons/logo_white.png")}
              style={{ width: cardWidth * 0.4, height: cardWidth * 0.4 * (374 / 255) }}
              contentFit="contain"
            />
          </Animated.View>

          {/* Front: the meal photo, name and price over a dark fade. */}
          <Animated.View style={[face, frontStyle]} className="absolute overflow-hidden rounded-3xl bg-white">
            <Pressable onPress={() => onViewDetails(shown)} className="flex-1" accessibilityLabel={`${shown.name}, view details`}>
              <Image source={resolveMealImage(shown)} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              <LinearGradient
                colors={TEXT_SCRIM}
                pointerEvents="none"
                style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: cardHeight * 0.45 }}
              />
              <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 gap-1 p-5">
                <Text numberOfLines={2} className="font-inter-bold text-subheading text-white">
                  {shown.name}
                </Text>
                <Text className="font-inter-semibold text-body text-white">
                  ₱{shown.price}
                  {shown.buffer_price ? ` – ₱${shown.buffer_price}` : ""}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </View>

      {overlay}
    </Modal>
  );
}
