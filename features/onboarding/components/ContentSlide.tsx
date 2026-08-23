import { View, Text } from "react-native";
import { Image } from "expo-image";
import { AppText } from "@/components/ui";
import type { ContentSlideData } from "../slides";

const heroColorClass = {
  primary: "text-primary",
  accent: "text-accent",
} as const;

type Props = {
  slide: ContentSlideData;
  width: number;
};

export function ContentSlide({ slide, width }: Props) {
  return (
    <View style={{ width }} className="flex-1 justify-center px-10 overflow-hidden">
      <View className="w-full items-center mb-8">
        {slide.image ? (
          <Image source={slide.image} style={{ width: 352, height: 332 }} contentFit="contain" />
        ) : (
          <View className="w-[255px] h-[306px] items-center justify-center">
            <AppText variant="caption" className="text-ink-subtle text-center px-4">
              GIF goes here — see assets/onboarding/
            </AppText>
          </View>
        )}
      </View>

      <AppText variant="eyebrow" className="mb-2">
        {slide.caption}
      </AppText>

      <Text className="font-inter-extrabold text-hero">
        {slide.hero.map((segment, i) => (
          <Text key={i}>
            <Text className={segment.color ? heroColorClass[segment.color] : "text-ink-emphasis"}>
              {segment.text}
            </Text>
            {segment.breakAfter && "\n"}
          </Text>
        ))}
      </Text>

      <AppText variant="body" className="text-ink-subtle mt-3">
        {slide.description}
      </AppText>
    </View>
  );
}
