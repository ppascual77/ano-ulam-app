import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { ChevronRight } from "lucide-react-native";
import { AppText } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { ContentSlideData } from "../slides";
import { HighlightedText } from "./HighlightedText";
import { HeroTitle } from "./HeroTitle";

// What each slide's `link` says.
const LINK_LABELS: Record<NonNullable<ContentSlideData["link"]>, string> = {
  numbers: "Where do our numbers come from?",
};

type Props = {
  slide: ContentSlideData;
  width: number;
  /** Opens the slide's explainer (only for slides with a `link`). */
  onLinkPress?: () => void;
  /** Stands in for the title's "." (see HeroTitle). */
  period?: ReactNode;
};

export function ContentSlide({ slide, width, onLinkPress, period }: Props) {
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

      <HeroTitle segments={slide.hero} className="text-hero" period={period} />

      <HighlightedText className="mt-3">{slide.description}</HighlightedText>

      {slide.link && onLinkPress && (
        // A soft pill rather than a bare link, so it reads as something to
        // open. 14px keeps the whole question on one line in the slide's
        // column. Orange, like the dot "Got it" later turns into.
        <Pressable
          onPress={onLinkPress}
          accessibilityRole="button"
          className="mt-5 flex-row items-center gap-2 self-start rounded-full bg-accent/85 py-2.5 pl-3.5 pr-3 active:opacity-80"
        >
          <View className="h-2 w-2 rounded-full bg-white" />
          <Text className="font-inter-semibold text-body text-white">{LINK_LABELS[slide.link]}</Text>
          <ChevronRight color={colors.white} size={16} />
        </Pressable>
      )}
    </View>
  );
}
