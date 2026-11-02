import { ReactNode, useRef } from "react";
import { Pressable, StyleSheet, Text, View, type ViewInstance } from "react-native";
import { BlurTargetView, BlurView } from "expo-blur";
import { EyeOff } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

type AvoidedMealCoverProps = {
  children: ReactNode;
  /** Opens Settings' Ingredients to avoid sheet. */
  onManage: () => void;
  /** Opens the meal anyway. */
  onView: () => void;
};

// A search result hidden by Pro's Ingredients to avoid: still shown (so the
// catalog doesn't look empty for that search), blurred under a note saying
// why, with a way to open it anyway or change the list. Android only blurs
// what's inside a BlurTargetView, so the card sits in one.
export function AvoidedMealCover({ children, onManage, onView }: AvoidedMealCoverProps) {
  const target = useRef<ViewInstance>(null);
  return (
    <View className="overflow-hidden rounded-2xl">
      <BlurTargetView ref={target} pointerEvents="none">
        {children}
      </BlurTargetView>
      {/* Positioned by style: NativeWind's className only reaches RN's own
          components. */}
      <BlurView
        blurTarget={target}
        blurMethod="dimezisBlurViewSdk31Plus"
        intensity={30}
        tint="light"
        style={StyleSheet.absoluteFill}
      >
        <View className="flex-1 items-center justify-center gap-3 px-5">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-white">
            <EyeOff color={colors.primary} size={20} />
          </View>
          <Text className="text-center font-inter-semibold text-body text-web-ink">Uses an ingredient you avoid</Text>
          <Pressable onPress={onManage} hitSlop={8} className="rounded-full border border-primary px-4 py-1.5 active:bg-primary/5">
            <Text className="font-inter-semibold text-body text-primary">Manage avoided ingredients</Text>
          </Pressable>
          <Pressable onPress={onView} hitSlop={8}>
            <Text className="font-inter-medium text-small text-primary underline">View anyway</Text>
          </Pressable>
        </View>
      </BlurView>
    </View>
  );
}
