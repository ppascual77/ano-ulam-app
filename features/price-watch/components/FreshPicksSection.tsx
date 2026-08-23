import { useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { AppText } from "@/components/ui";
import { colors } from "@/constants/theme";
import { FreshPickCard } from "./FreshPickCard";
import { freshPicks } from "../mocks/freshPicks";

// Screen's own px-7 horizontal padding (28px each side).
const SCREEN_PADDING = 56;
const CARD_HEIGHT = 160;

// Arrow-button paging, not a swipeable ScrollView — a horizontal ScrollView
// nested in the page's vertical one was blocking both scroll directions
// for this whole section (confirmed via the element inspector: it's a pan
// gesture responder conflict, not a layout/overlay issue), so this sidesteps
// nested scrolling entirely.
export function FreshPicksSection() {
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = windowWidth - SCREEN_PADDING;
  const [index, setIndex] = useState(0);

  const canGoPrev = index > 0;
  const canGoNext = index < freshPicks.length - 1;

  return (
    <View className="gap-3">
      <View>
        <AppText variant="title">This week&apos;s fresh picks</AppText>
        <AppText variant="caption">The sharpest price drops this week, one pick per category.</AppText>
      </View>

      <View className="items-center">
        <FreshPickCard pick={freshPicks[index]} width={cardWidth} />

        {canGoPrev && (
          <Pressable
            onPress={() => setIndex((i) => i - 1)}
            style={{ top: CARD_HEIGHT / 2 - 18 }}
            className="absolute left-2 h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/20"
          >
            <ChevronLeft color={colors.white} size={20} />
          </Pressable>
        )}
        {canGoNext && (
          <Pressable
            onPress={() => setIndex((i) => i + 1)}
            style={{ top: CARD_HEIGHT / 2 - 18 }}
            className="absolute right-2 h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/20"
          >
            <ChevronRight color={colors.white} size={20} />
          </Pressable>
        )}
      </View>

      <View className="flex-row items-center justify-center gap-2">
        {freshPicks.map((_, i) => (
          <View
            key={i}
            className={`h-2 rounded-full ${i === index ? "w-6 bg-primary" : "w-2 bg-primary/20"}`}
          />
        ))}
      </View>
    </View>
  );
}
