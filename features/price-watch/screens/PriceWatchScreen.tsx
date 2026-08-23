import { ScrollView, Text, View } from "react-native";
import { Info } from "lucide-react-native";
import { AppText, Avatar, NoticeBanner, Screen } from "@/components/ui";
import { colors } from "@/constants/theme";
import { FreshPicksSection } from "../components/FreshPicksSection";
import { CategoryGrid } from "../components/CategoryGrid";
import { BestValueMealsSection } from "@/core/meals/components/BestValueMealsSection";

export default function PriceWatchScreen() {
  return (
    <Screen edges={["top"]}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <AppText variant="title">Price Watch</AppText>
            <AppText variant="caption">See what&apos;s cheaper this week and cook for less.</AppText>
          </View>
          {/* TODO: "Patrick" is a placeholder — replace with the
              authenticated user's first name once auth/profile data is
              wired up. */}
          <Avatar name="Patrick" size={48} />
        </View>

        {/* TEMP diagnostic: full-length wrapping copy restored, but no nested Text spans (no underline). */}
        <View className="mt-4">
          <NoticeBanner icon={<Info color={colors.notice.icon} size={15} />}>
            <AppText variant="caption" className="text-notice-text">
              Prices are weekly averages across 30 NCR markets from DA reports. Prices may vary —
              use as a general guide for your grocery budget. See DA price monitoring →
            </AppText>
          </NoticeBanner>
        </View>

        {/* TEMP diagnostic: FreshPicksSection disabled to isolate the NoticeBanner test. */}
        <View className="mt-6">
          <FreshPicksSection />
        </View>

        <View className="mt-6 mb-6">
          <BestValueMealsSection />
        </View>

        <View className="mb-6">
          <CategoryGrid />
        </View>
      </ScrollView>
    </Screen>
  );
}
