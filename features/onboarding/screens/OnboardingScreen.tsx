import { useRef, useState } from "react";
import {
  View,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { Screen, AppText, Button } from "@/components/ui";
import { OnboardingSlide } from "../components/OnboardingSlide";
import { onboardingSlides } from "../slides";

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === onboardingSlides.length - 1;

  const goToSignup = () => router.replace("/signup");

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const handleNext = () => {
    if (isLast) {
      goToSignup();
      return;
    }
    scrollRef.current?.scrollTo({ x: width * (index + 1), animated: true });
  };

  return (
    <Screen padded={false}>
      <View className="flex-row justify-end px-6 pt-2">
        <AppText variant="body" className="text-ink-subtle" onPress={goToSignup}>
          Skip
        </AppText>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        className="flex-1"
      >
        {onboardingSlides.map((slide) => (
          <OnboardingSlide key={slide.id} slide={slide} width={width} />
        ))}
      </ScrollView>

      <View className="flex-row justify-center gap-2 mb-6">
        {onboardingSlides.map((slide, i) => (
          <View
            key={slide.id}
            className={`h-2 rounded-full ${i === index ? "w-6 bg-primary" : "w-2 bg-primary/20"}`}
          />
        ))}
      </View>

      <View className="px-6 mb-6">
        <Button label={isLast ? "Get Started" : "Next"} variant="primary" onPress={handleNext} />
      </View>
    </Screen>
  );
}
