import { View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen, showGlobalToast } from "@/frontend/components/ui";
import { ProPage } from "@/frontend/core/pro/components/ProPage";

// The /pro route: the full Pro page as a screen (Settings, the planner's
// upsell). Inside the meal sheet, MealDetailSheet shows the same ProPage.
//
// Safe area from the root provider (useSafeAreaInsets), not Screen's own
// SafeAreaView: in this full-screen modal that native view sometimes reads
// 0 on first show, which put the close button under the status bar.
export default function ProScreen() {
  const insets = useSafeAreaInsets();
  return (
    <Screen edges={[]} padded={false} dismissKeyboardOnTap={false}>
      <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <ProPage
          onClose={() => router.back()}
          onStarted={() => {
            showGlobalToast({ message: "Pro unlocked (test)", tone: "success" });
            router.back();
          }}
        />
      </View>
    </Screen>
  );
}
