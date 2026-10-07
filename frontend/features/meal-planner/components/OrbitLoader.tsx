import { useEffect } from "react";
import { type ImageSourcePropType, View } from "react-native";
import { Image } from "expo-image";
import Animated, {
  Easing,
  type SharedValue,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import type { MealType } from "@/frontend/core/meals/mealTypes";

// "Planning your week..." illustration: meal photos orbiting the AnoUlam fork
// logo, which gently pulses at the center.

const SIZE = 180; // square, same footprint as the GIF it replaced
const PHOTO_COUNT = 5;
const PHOTO_SIZE = 52;
const ORBIT_RADIUS = 62;
const ORBIT_MS = 5200; // one full lap
const LOGO_WIDTH = 40;
const LOGO_ASPECT = 512 / 358; // logo_clean.png's height / width
const PULSE_MS = 900;
const PULSE_SCALE = 1.08;
// Photos pop in one after another when the loader appears.
const PHOTO_STAGGER_MS = 70;
const POP_SPRING = { damping: 9, stiffness: 180, mass: 0.6 };
// Used when no meal in the pool has a photo yet.
const FALLBACK_PHOTOS: ImageSourcePropType[] = [require("@/assets/mock-adobo-meal.jpg"), require("@/assets/mock-kaldereta-meal.jpg")];

function hasPhoto(src: ImageSourcePropType) {
  return typeof src === "number" || (!Array.isArray(src) && !!src.uri);
}

/** Up to PHOTO_COUNT photos from the meals being planned with, repeating
 *  them if there are fewer. */
function pickPhotos(meals: MealType[]): ImageSourcePropType[] {
  const photos = meals.map(resolveMealImage).filter(hasPhoto);
  const source = photos.length ? photos : FALLBACK_PHOTOS;
  return Array.from({ length: PHOTO_COUNT }, (_, i) => source[i % source.length]);
}

function OrbitPhoto({ source, index, turn }: { source: ImageSourcePropType; index: number; turn: SharedValue<number> }) {
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = withDelay(index * PHOTO_STAGGER_MS, withSpring(1, POP_SPRING));
  }, []);
  const style = useAnimatedStyle(() => {
    const angle = (index / PHOTO_COUNT) * Math.PI * 2 + turn.value * Math.PI * 2;
    return {
      transform: [
        { translateX: Math.cos(angle) * ORBIT_RADIUS },
        { translateY: Math.sin(angle) * ORBIT_RADIUS },
        { scale: pop.value },
      ],
    };
  });
  return (
    <Animated.View
      style={[{ position: "absolute", left: (SIZE - PHOTO_SIZE) / 2, top: (SIZE - PHOTO_SIZE) / 2, width: PHOTO_SIZE, height: PHOTO_SIZE }, style]}
      className="rounded-full bg-white shadow-md"
    >
      <View className="flex-1 overflow-hidden rounded-full border-2 border-white">
        <Image source={source} style={{ width: "100%", height: "100%" }} contentFit="cover" />
      </View>
    </Animated.View>
  );
}

export function OrbitLoader({ meals }: { meals: MealType[] }) {
  const photos = pickPhotos(meals);
  const turn = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    turn.value = withRepeat(withTiming(1, { duration: ORBIT_MS, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => {
      cancelAnimation(turn);
      cancelAnimation(pulse);
    };
  }, []);

  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + (PULSE_SCALE - 1) * pulse.value }] }));

  return (
    <View style={{ width: SIZE, height: SIZE }} accessibilityRole="progressbar" accessibilityLabel="Planning your week">
      <Animated.View
        style={[{ position: "absolute", left: (SIZE - LOGO_WIDTH) / 2, top: (SIZE - LOGO_WIDTH * LOGO_ASPECT) / 2 }, logoStyle]}
      >
        <Image source={require("@/assets/icons/logo_clean.png")} style={{ width: LOGO_WIDTH, height: LOGO_WIDTH * LOGO_ASPECT }} contentFit="contain" />
      </Animated.View>
      {photos.map((source, i) => (
        <OrbitPhoto key={i} source={source} index={i} turn={turn} />
      ))}
    </View>
  );
}
