import { useEffect } from "react";
import { ImageSourcePropType, Pressable, View } from "react-native";
import { Image } from "expo-image";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import type { LucideIcon } from "lucide-react-native";
import { AppText } from "@/frontend/components/ui";

const RADIUS = 8;
const BORDER = 2;
const FADE = { duration: 220, easing: Easing.out(Easing.quad) };

type Props = {
  label: string;
  image: ImageSourcePropType;
  badgeIcon: LucideIcon;
  badgeColor: string;
  bgClassName: string;
  borderClassName: string;
  selected: boolean;
  onPress: () => void;
};

export function CategoryCard({ label, image, badgeIcon: BadgeIcon, badgeColor, bgClassName, borderClassName, selected, onPress }: Props) {
  // The selected outline is an accent border laid exactly over the card's
  // own, faded in and out, so the color change is smooth (a border color
  // class would just swap).
  const active = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    active.value = withTiming(selected ? 1 : 0, FADE);
  }, [selected, active]);
  const outlineStyle = useAnimatedStyle(() => ({ opacity: active.value }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`flex-1 items-center border ${bgClassName} ${borderClassName}`}
      style={{ borderRadius: RADIUS, paddingVertical: 12, borderWidth: BORDER }}
    >
      <Animated.View
        pointerEvents="none"
        className="border-accent"
        style={[
          { position: "absolute", top: -BORDER, left: -BORDER, right: -BORDER, bottom: -BORDER, borderRadius: RADIUS, borderWidth: BORDER },
          outlineStyle,
        ]}
      />

      <View className="absolute" style={{ top: 8, right: 8, zIndex: 10 }}>
        <BadgeIcon color={badgeColor} size={16} strokeWidth={1} />
      </View>

      <Image source={image} style={{ width: 65, height: 65 }} contentFit="contain" />

      <AppText variant="bodyMedium" className="mt-1">
        {label}
      </AppText>
    </Pressable>
  );
}
