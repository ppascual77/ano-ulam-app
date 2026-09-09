import { View, Pressable } from "react-native";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Screen, AppText } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

export default function ProfileScreen() {
  return (
    <Screen>
      <View className="mt-2 flex-row items-center gap-2">
        <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center">
          <ArrowLeft color={colors.ink.emphasis} size={18} />
        </Pressable>
        <AppText variant="title">Profile</AppText>
      </View>

      <View className="flex-1 items-center justify-center">
        <AppText variant="heading">Profile</AppText>
        <AppText variant="body" className="text-ink-subtle mt-2 text-center">
          Placeholder — build the real profile screen here.
        </AppText>
      </View>
    </Screen>
  );
}
