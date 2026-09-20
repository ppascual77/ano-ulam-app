import { View, Pressable } from "react-native";
import { Image } from "expo-image";
import { Check } from "lucide-react-native";
import { AppText } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { PreferencesSlideData } from "../slides";

type Props = {
  slide: PreferencesSlideData;
  width: number;
  selected: Set<string>;
  onToggle: (id: string) => void;
};

export function PreferencesSlide({ slide, width, selected, onToggle }: Props) {
  return (
    <View style={{ width }} className="flex-1 px-10 justify-center">
      <View className="flex-row items-end justify-between mb-14">
        <AppText variant="subhero" className="flex-1">
          {slide.title}
        </AppText>
        {slide.image && (
          <Image
            source={slide.image}
            style={{ width: 100, height: 100 }}
            contentFit="contain"
          />
        )}
      </View>

      <View className="gap-3">
        {slide.options.map((option) => {
          const isSelected = selected.has(option.id);
          const Icon = option.icon;
          return (
            <Pressable
              key={option.id}
              onPress={() => onToggle(option.id)}
              className="flex-row items-center gap-3 rounded-2xl border border-primary/10 px-4 py-3.5"
            >
              <Icon color={colors.accent} size={20} />
              <AppText variant="body" className="flex-1">
                {option.label}
              </AppText>
              <View
                className={`w-6 h-6 rounded-full items-center justify-center ${
                  isSelected ? "bg-primary" : "border border-primary/20"
                }`}
              >
                {isSelected && <Check color={colors.white} size={14} />}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
