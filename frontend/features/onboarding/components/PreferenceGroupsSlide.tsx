import { useState } from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import { Lock } from "lucide-react-native";
import { AppText, ChipSelect } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { PreferenceGroupsSlideData } from "../slides";

type Props = {
  slide: PreferenceGroupsSlideData;
  width: number;
};

export function PreferenceGroupsSlide({ slide, width }: Props) {
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  const setGroupValue = (groupId: string, value: string[]) => {
    setSelections((prev) => ({ ...prev, [groupId]: value }));
  };

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

        <AppText variant="body" className="text-ink-subtle mb-6">
          {slide.subtitle}
        </AppText>
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
              onChange={(value) => setGroupValue(group.id, value)}
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
