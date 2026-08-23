import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { TrendingDown } from "lucide-react-native";
import { colors } from "@/constants/theme";
import type { FreshPick } from "../mocks/freshPicks";

type FreshPickCardProps = {
  pick: FreshPick;
  width: number;
};

// No product photo for now — the gradient + text alone.
//
// The gradient is an absolute-fill background behind a plain View, rather
// than LinearGradient itself being the outer/touchable element — inside a
// horizontal Carousel nested in the page's vertical ScrollView, having
// LinearGradient (a custom native view) sit directly in the scroll gesture's
// hit-testing path blocked both scroll directions for this whole section.
export function FreshPickCard({ pick, width }: FreshPickCardProps) {
  return (
    <View style={{ width, height: 160, borderRadius: 24 }} className="overflow-hidden">
      <LinearGradient
        colors={pick.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      <View className="flex-1 justify-between p-4">
        <View className="flex-row items-center gap-1 self-start rounded-full border border-white/20 bg-white/15 px-2 py-1">
          <TrendingDown color={colors.white} size={12} />
          <Text className="font-inter-semibold text-sub text-white">
            {pick.percentCheaper}% cheaper this week
          </Text>
        </View>

        <View>
          <Text className="font-inter-semibold text-body text-white">{pick.name}</Text>
          <Text className="font-inter-bold text-heading text-white">₱{pick.price.toFixed(2)}</Text>
          <Text className="text-sub text-white/70">was ₱{pick.previousPrice.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}
