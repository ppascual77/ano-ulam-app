import { useEffect } from "react";
import { Text } from "@/frontend/components/ui/Text";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/frontend/components/ui";
import { ProPage } from "@/frontend/core/pro/components/ProPage";
import { trackProPageOpened, type ProSource } from "@/frontend/core/analytics/analytics";

// The /pro route: the full Pro page as a screen (Settings, the planner's
// upsell). Inside the meal sheet, MealDetailSheet shows the same ProPage.
//
// ProPage pads the safe area itself (from the root provider's
// useSafeAreaInsets, not Screen's own SafeAreaView: in this full-screen
// modal that native view sometimes reads 0 on first show), so its unlock
// screen can run under the status bar.
export default function ProScreen() {
  // Optional, from an upsell (e.g. the planner's locked days): the page's
  // title speaks to what was tapped, ending in an orange `highlight` word.
  const { title, highlight, subtitle, source } = useLocalSearchParams<{
    title?: string;
    highlight?: string;
    subtitle?: string;
    /** What opened it, for analytics (pro_page_opened). */
    source?: ProSource;
  }>();
  useEffect(() => {
    trackProPageOpened(source ?? "other");
    // Once per opening.
  }, []);
  return (
    <Screen edges={[]} padded={false} dismissKeyboardOnTap={false}>
      <ProPage
        title={
          title ? (
            <>
              {title}
              {highlight ? <Text className="text-brand-orange"> {highlight}</Text> : null}
            </>
          ) : undefined
        }
        subtitle={subtitle}
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
