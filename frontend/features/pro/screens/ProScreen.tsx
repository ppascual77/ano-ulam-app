import { router } from "expo-router";
import { Screen } from "@/frontend/components/ui";
import { ProPage } from "@/frontend/core/pro/components/ProPage";

// The /pro route: the full Pro page as a screen (Settings, the planner's
// upsell). Inside the meal sheet, MealDetailSheet shows the same ProPage.
//
// ProPage pads the safe area itself (from the root provider's
// useSafeAreaInsets, not Screen's own SafeAreaView: in this full-screen
// modal that native view sometimes reads 0 on first show), so its unlock
// screen can run under the status bar.
export default function ProScreen() {
  return (
    <Screen edges={[]} padded={false} dismissKeyboardOnTap={false}>
      <ProPage
        onClose={() => router.back()}
        onManage={() => {
          router.back();
          router.navigate({ pathname: "/profile/settings", params: { plan: "1" } });
        }}
        onStarted={() => router.back()}
      />
    </Screen>
  );
}
