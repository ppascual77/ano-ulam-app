import { ReactNode } from "react";
import { ScrollView, View } from "react-native";

type CarouselProps = {
  children: ReactNode[];
};

// Touch scroll is the primary mobile interaction, so unlike the web version
// this has no left/right chevron buttons — just horizontal momentum scroll.
export function Carousel({ children }: CarouselProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      contentContainerClassName="gap-4 px-1"
    >
      {children.map((child, i) => (
        <View key={i}>{child}</View>
      ))}
    </ScrollView>
  );
}
