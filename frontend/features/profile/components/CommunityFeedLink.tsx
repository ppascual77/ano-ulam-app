import { Pressable, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

// Row under the profile header that jumps to Discover's Community tab.
export function CommunityFeedLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="mx-5 mt-4 flex-row items-center gap-3 rounded-2xl border border-brand-green/20 px-4 py-3 active:bg-brand-green/15"
    >
      <View className="flex-1">
        <Text className="font-inter-semibold text-body text-web-ink">Community Feed</Text>
        <Text className="mt-0.5 font-inter-regular text-small text-web-ink-muted">Join the food conversation</Text>
      </View>
      <ChevronRight color={colors.webInk.muted} size={16} />
    </Pressable>
  );
}
