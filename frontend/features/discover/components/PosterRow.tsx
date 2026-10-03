import { Image, Text, View } from "react-native";
import { BadgeCheck } from "lucide-react-native";
import { Avatar } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

type PosterRowProps = {
  /** null = an official AnoUlam meal. */
  posterId: string | null | undefined;
  /** Display name for a community poster. Meals don't carry this yet (no
   *  profiles table), so community posters fall back to a generic label. */
  posterName?: string;
};

// "Who made this" under the reel's meal details. Not tappable yet: there
// are no profile screens in the app to open.
export function PosterRow({ posterId, posterName }: PosterRowProps) {
  if (!posterId) {
    return (
      <View className="flex-row items-center gap-2">
        <Image source={require("@/assets/icon.png")} className="h-6 w-6 rounded-full" />
        <Text className="font-inter-semibold text-body text-white">AnoUlam</Text>
        <BadgeCheck color={colors.white} fill={colors.verified} size={16} />
      </View>
    );
  }

  const name = posterName ?? "Community cook";
  return (
    <View className="flex-row items-center gap-2">
      <Avatar name={name} size={24} />
      <View>
        <Text className="font-inter-regular text-sub text-white/60">Created by</Text>
        <Text className="font-inter-semibold text-body text-white">{name}</Text>
      </View>
    </View>
  );
}
