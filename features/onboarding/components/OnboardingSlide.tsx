import { View } from "react-native";
import { Image } from "expo-image";
import { AppText } from "@/components/ui";
import type { OnboardingSlideData } from "../slides";

type Props = {
  slide: OnboardingSlideData;
  width: number;
};

export function OnboardingSlide({ slide, width }: Props) {
  return (
    <View style={{ width }} className="flex-1 px-6 items-center justify-center">
      <View className="w-full aspect-square rounded-2xl bg-primary/5 items-center justify-center mb-8">
        {slide.image ? (
          <Image
            source={slide.image}
            style={{ width: "100%", height: "100%" }}
            contentFit="contain"
          />
        ) : (
          <AppText variant="caption" className="text-ink-subtle text-center px-4">
            GIF goes here — see assets/onboarding/
          </AppText>
        )}
      </View>
      <AppText variant="heading" className="text-center mb-2">
        {slide.title}
      </AppText>
      <AppText variant="body" className="text-ink-subtle text-center">
        {slide.description}
      </AppText>
    </View>
  );
}
