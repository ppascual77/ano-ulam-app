import { ReactNode, useEffect, useState } from "react";
import { Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import type { MealType } from "@/frontend/core/meals/mealTypes";

// Zoom and spin share one timeline: quick at first, then slowing down
// before it settles face up (a gentle ease-out, not the steep cubic one
// that spun out while the card was still tiny).
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
const HEIGHT_SHARE = 0.48;
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
  const cardWidth = Math.min(screenWidth * 0.68, cardHeight * ASPECT);

  // Keep the last meal rendered while fading out.
  const [shown, setShown] = useState<MealType | null>(meal);
  const progress = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (meal) {
      setShown(meal);
      progress.value = 0;
      fade.value = withTiming(1, { duration: 250 });
      progress.value = withTiming(1, { duration: REVEAL_MS, easing: Easing.out(Easing.quad) }, (finished) => {
        if (finished && onLanded) scheduleOnRN(onLanded);
      });
    } else if (shown) {
      fade.value = withTiming(0, { duration: EXIT_MS }, (finished) => {
        if (finished) scheduleOnRN(setShown, null);
      });
    }
    // Only when the meal changes.
  }, [meal]);

  // The card never really turns past edge-on: the angle is folded into
  // -90..90 and the face swaps at each edge-on moment (when the card is a
  // thin line, so the swap is invisible). It reads as a continuous spin, but
  // iOS never draws a view from behind, which is what kept hiding or
  // mirroring the back face (backface culling of React Native's flattened
  // views).
  const cardStyle = useAnimatedStyle(() => {
    const deg = interpolate(progress.value, [0, 1], [START_DEG, END_DEG]);
    const folded = ((((deg + 90) % 180) + 180) % 180) - 90;
    return {
      opacity: fade.value,
      transform: [
        { perspective: PERSPECTIVE },
        { scale: interpolate(progress.value, [0, 1], [START_SCALE, 1]) },
        { rotateY: `${folded}deg` },
      ],
    };
  });
  // Front while the real angle faces the viewer, back otherwise.
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

      {/* collapsable={false}: keeps this wrapper as a real native view, so
          the card's 3D turn is flattened inside it. Without it React Native
          folds the wrapper away, the card and the backdrop become siblings,
          and iOS depth-sorts them: whichever half of the card tilts "behind"
          the screen goes under the dim backdrop (a gray half that flips sides). */}
      <View collapsable={false} pointerEvents="box-none" className="flex-1 items-center justify-center">
        <Animated.View style={[{ width: cardWidth, height: cardHeight }, cardStyle]}>
          {/* Back: green with the white logo. */}
          <Animated.View
            style={[face, backStyle]}
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
