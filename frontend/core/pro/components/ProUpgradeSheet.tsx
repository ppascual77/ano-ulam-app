import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Check, Crown } from "lucide-react-native";
import { AppText, BottomSheet, Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

const BENEFITS = ["Full 5-day meal plan", "Swap meals", "Ingredients to avoid", "Personalized nutrition planning"];

type ProUpgradeSheetProps = {
  visible: boolean;
  /** What was tapped, e.g. "Your next 4 days are ready". */
  title: ReactNode;
  body: string;
  onClose: () => void;
  onUnlock: () => void;
};

// Tapping anything Pro without Pro: a light upsell, not a paywall. Used by
// the Meal Planner's locked days and Settings' Pro rows.
export function ProUpgradeSheet({ visible, title, body, onClose, onUnlock }: ProUpgradeSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} heightPercent={0.7} fitContent>
      <View className="gap-5 px-6 pb-8 pt-10">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-orange/15">
          <Crown color={colors.brandOrange} size={24} />
        </View>
        <View>
          <AppText variant="sectionTitle" dot>
            {title}
          </AppText>
          <Text className="mt-1 font-inter-regular text-body text-web-ink-muted">{body}</Text>
        </View>
        <View className="gap-2.5">
          {BENEFITS.map((benefit) => (
            <View key={benefit} className="flex-row items-center gap-3">
              <View className="h-5 w-5 items-center justify-center rounded-full bg-brand-green">
                <Check color={colors.white} size={12} strokeWidth={3} />
              </View>
              <Text className="font-inter-medium text-body text-web-ink-soft">{benefit}</Text>
            </View>
          ))}
        </View>
        <View className="gap-3">
          <Button label="Unlock Pro" onPress={onUnlock} />
          <Pressable onPress={onClose} hitSlop={8} className="items-center">
            <Text className="font-inter-medium text-body text-web-ink-muted">Not now</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}
