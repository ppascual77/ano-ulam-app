import { View, Text } from "react-native";
import { Image } from "expo-image";
import { Check } from "lucide-react-native";
import { AppText, Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { AccountPitchSlideData } from "../slides";

const heroColorClass = {
  primary: "text-primary",
  accent: "text-accent",
} as const;

type Props = {
  slide: AccountPitchSlideData;
  width: number;
};

export function AccountPitchSlide({ slide, width }: Props) {
  return (
    <View style={{ width }} className="flex-1 px-10 justify-center">
      <View className="w-full items-center mt-4">
        {slide.image && (
          <Image source={slide.image} style={{ width: 210, height: 210 }} contentFit="contain" />
        )}
      </View>

      <Text className="font-inter-extrabold text-heading text-center mb-2">
        {slide.hero.map((segment, i) => (
          <Text key={i} className={segment.color ? heroColorClass[segment.color] : "text-ink-emphasis"}>
            {segment.text}
          </Text>
        ))}
      </Text>

      <AppText variant="body" className="text-ink-subtle text-center mb-6">
        {slide.subtitle}
      </AppText>

      <View className="gap-3 mb-6">
        {slide.benefits.map((benefit) => (
          <View
            key={benefit}
            className="flex-row items-center gap-3 rounded-2xl px-7 py-2"
          >
            <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
              <Check color={colors.white} size={14} />
            </View>
            <AppText variant="body" className="flex-1">
              {benefit}
            </AppText>
          </View>
        ))}
      </View>

      <View className="gap-3 mb-4">
        <Button
          label="Continue with Google"
          variant="social"
          icon={
            <Image
              source={require("@/assets/icons/google-logo.png")}
              style={{ width: 18, height: 18 }}
              contentFit="contain"
            />
          }
          onPress={() => {}}
        />
        <Button
          label="Continue with Apple"
          variant="social"
          icon={
            <Image
              source={require("@/assets/icons/apple-logo.png")}
              style={{ width: 18, height: 18 }}
              contentFit="contain"
            />
          }
          onPress={() => {}}
        />
      </View>

      <AppText variant="body" className="text-primary text-center" onPress={() => {}}>
        Continue without an account
      </AppText>
    </View>
  );
}
