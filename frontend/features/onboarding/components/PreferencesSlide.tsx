import { useEffect } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { AppText, PulsePressable } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import type { PreferenceOption, PreferencesSlideData } from "../slides";

const BADGE_SPRING = { damping: 12, stiffness: 380, mass: 0.6 };

type Props = {
  slide: PreferencesSlideData;
  width: number;
  selected: Set<string>;
  onToggle: (id: string) => void;
};

// Goals as a 2-column grid of tiles: the header (title, one line of how it
// works, the art) leads, then six tiles you can scan in three rows instead
// of a long list. A picked tile fills with a primary tint, its border and
// icon turn primary, and a check badge pops in at the corner, so the
// choice reads at a glance, not just from a small circle at the row's end.
export function PreferencesSlide({ slide, width, selected, onToggle }: Props) {
  return (
    <View style={{ width }} className="flex-1 justify-center px-8">
      <View className="mb-8 flex-row items-end justify-between gap-3">
        <View className="flex-1">
          <AppText variant="subhero" className="tracking-display" dot>
            {slide.title}
          </AppText>
          <AppText variant="caption" className="mt-2">
            Pick as many as you like. You can change these anytime.
          </AppText>
        </View>
        {slide.image && <Image source={slide.image} style={{ width: 88, height: 88 }} contentFit="contain" />}
      </View>

      <View className="flex-row flex-wrap justify-between gap-y-3">
        {slide.options.map((option) => (
          <GoalTile
            key={option.id}
            option={option}
            selected={selected.has(option.id)}
            onPress={() => {
              Haptics.selectionAsync();
              onToggle(option.id);
            }}
          />
        ))}
      </View>
    </View>
  );
}

function GoalTile({ option, selected, onPress }: { option: PreferenceOption; selected: boolean; onPress: () => void }) {
  const reduceMotion = useReduceMotion();
  const Icon = option.icon;

  // The badge pops in with a little overshoot; Reduce motion: a fade.
  const badge = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    badge.value = reduceMotion ? withTiming(selected ? 1 : 0, { duration: 150 }) : withSpring(selected ? 1 : 0, BADGE_SPRING);
  }, [selected, badge, reduceMotion]);
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(badge.value, 1),
    transform: [{ scale: reduceMotion ? 1 : badge.value }],
  }));

  // The width sits on a wrapper: PulsePressable puts className on the
  // Pressable inside its own animated wrapper.
  return (
    <View className="w-[48.5%]">
      <PulsePressable
        pulse="subtle"
        radius={16}
        onPress={onPress}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={option.label}
        className={`min-h-[104px] justify-between rounded-2xl border p-4 ${
          selected ? "border-primary bg-primary/5" : "border-ink-emphasis/10 bg-white"
        }`}
      >
        <View className="flex-row items-start justify-between">
          <View className={`h-10 w-10 items-center justify-center rounded-full ${selected ? "bg-primary/10" : "bg-accent/10"}`}>
            <Icon color={selected ? colors.primary : colors.accent} size={20} />
          </View>
          <Animated.View style={badgeStyle}>
            <View className="h-5 w-5 items-center justify-center rounded-full bg-primary">
              <Check color={colors.white} size={12} strokeWidth={3} />
            </View>
          </Animated.View>
        </View>
        <AppText variant="body" className={`mt-3 ${selected ? "font-inter-semibold text-ink-emphasis" : ""}`}>
          {option.label}
        </AppText>
      </PulsePressable>
    </View>
  );
}
