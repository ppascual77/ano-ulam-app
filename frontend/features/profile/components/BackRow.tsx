import { Pressable, Text } from "react-native";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

// "← Back" above someone else's / the official profile.
export function BackRow() {
  return (
    <Pressable onPress={() => router.back()} hitSlop={8} className="flex-row items-center gap-1.5 self-start px-5 pb-1 pt-3">
      <ArrowLeft color={colors.webInk.muted} size={16} />
      <Text className="font-inter-regular text-body text-web-ink-muted">Back</Text>
    </Pressable>
  );
}
