import { View, Text } from "react-native";
import { Image } from "expo-image";
import { Lock } from "lucide-react-native";
import { AppText, ChipSelect } from "@/frontend/components/ui";
import { HighlightedText } from "./HighlightedText";
import { colors } from "@/frontend/constants/theme";
import type { PreferenceGroupsSlideData } from "../slides";

type Props = {
  slide: PreferenceGroupsSlideData;
  width: number;
  selections: Record<string, string[]>;
  onGroupChange: (groupId: string, value: string[]) => void;
};

export function PreferenceGroupsSlide({ slide, width, selections, onGroupChange }: Props) {
  return (
    <View style={{ width }} className="flex-1 px-10 py-16">
      <View className="mb-4">
        <View className="flex-row items-center mb-3">
          <AppText variant="subhero">{slide.title}</AppText>
          {slide.image && (
            <Image
              source={slide.image}
              style={{ width: 60, height: 60 }}
              contentFit="contain"
            />
          )}
        </View>

        <HighlightedText className="mb-6">{slide.subtitle}</HighlightedText>
      </View>

      <View className="gap-6">
        {slide.groups.map((group) => (
          <View key={group.id}>
            <AppText variant="heading" className="mb-7">
              {group.title}
            </AppText>
            <ChipSelect
              options={group.options}
              mode={group.mode}
              value={selections[group.id] ?? []}
              onChange={(value) => onGroupChange(group.id, value)}
            />
          </View>
        ))}
      </View>

      <View className="flex-row items-start gap-2 rounded-2xl bg-primary/5 p-4 mt-6 items-center mt-24">
        <Lock color={colors.primary} size={18} />
        <Text className="flex-1 font-inter-regular text-[14px] text-primary">
          {slide.note}
        </Text>
      </View>
    </View>
  );
}
