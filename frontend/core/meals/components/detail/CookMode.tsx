import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, Text, View, useWindowDimensions, type FlatListInstance } from "react-native";
import { StatusBar } from "expo-status-bar";
import { canKeepAwake } from "../../nativeFeatures";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, FadeIn, FadeOut, SlideInDown, SlideOutDown, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { X } from "lucide-react-native";
import { Button, DotLabel } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

const EASE = Easing.out(Easing.cubic);

function ProgressSegment({ filled }: { filled: boolean }) {
  const fill = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    fill.value = withTiming(filled ? 1 : 0, { duration: 250, easing: EASE });
  }, [filled]);
  const style = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View className="h-1 flex-1 overflow-hidden rounded-full bg-ink-emphasis/10">
      <Animated.View style={[{ height: "100%", borderRadius: 999, backgroundColor: colors.primary }, style]} />
    </View>
  );
}

type CookModeProps = {
  mealName: string;
  steps: string[];
  onClose: () => void;
};

// "Start cooking" from meal details: one step at a time, large enough to
// read from the counter, swipe or tap Next to move on. The screen stays
// awake while it's open. Rendered over the meal page (inside the same
// sheet), so the meal is right where it was on close.
const KEEP_AWAKE_TAG = "cook-mode";

export function CookMode({ mealName, steps, onClose }: CookModeProps) {
  // The screen stays on while cooking. Loaded lazily: expo-keep-awake throws
  // on import in a build without it (see nativeFeatures.ts).
  useEffect(() => {
    if (!canKeepAwake) return;
    const KeepAwake = require("expo-keep-awake") as typeof import("expo-keep-awake");
    void KeepAwake.activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => void KeepAwake.deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
  }, []);
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const list = useRef<FlatListInstance>(null);
  const last = index === steps.length - 1;

  // A light tick each time the step changes (swipe or button).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void Haptics.selectionAsync();
  }, [index]);

  const goTo = (i: number) => {
    const target = Math.max(0, Math.min(steps.length - 1, i));
    list.current?.scrollToIndex({ index: target, animated: !reduceMotion });
    setIndex(target);
  };

  return (
    <Animated.View
      entering={reduceMotion ? FadeIn.duration(200) : SlideInDown.duration(320).easing(EASE)}
      exiting={reduceMotion ? FadeOut.duration(150) : SlideOutDown.duration(260).easing(EASE)}
      className="absolute inset-0 bg-white"
      style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }}
    >
      <StatusBar style="dark" />
      <View className="flex-row items-center gap-3 px-5">
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityLabel="Close cook mode"
          className="h-10 w-10 items-center justify-center rounded-full bg-ink-emphasis/5"
        >
          <X color={colors.ink.emphasis} size={20} />
        </Pressable>
        <Text numberOfLines={1} className="flex-1 font-inter-semibold text-body text-ink-subtle">
          {mealName}
        </Text>
        <Text className="font-inter-semibold text-body text-ink-emphasis">
          {index + 1} / {steps.length}
        </Text>
      </View>
      <View className="mt-4 flex-row gap-1.5 px-5">
        {steps.map((_, i) => (
          <ProgressSegment key={i} filled={i <= index} />
        ))}
      </View>

      <FlatList
        ref={list}
        data={steps}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        className="flex-1"
        renderItem={({ item, index: i }) => (
          <View style={{ width }} className="flex-1 justify-center px-7">
            <DotLabel>{`Step ${i + 1}`}</DotLabel>
            {/* Read from arm's length mid-cook: the largest reading size. */}
            <Text className="mt-4 font-inter-medium text-heading leading-9 text-ink-emphasis">{item}</Text>
          </View>
        )}
      />

      <View className="flex-row gap-3 px-5">
        <View className="flex-1">
          <Button label="Back" variant="outline" onPress={() => goTo(index - 1)} disabled={index === 0} />
        </View>
        <View className="flex-1">
          <Button label={last ? "Done" : "Next step"} onPress={() => (last ? onClose() : goTo(index + 1))} />
        </View>
      </View>
    </Animated.View>
  );
}
