import { Image, Pressable } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { BadgeCheck } from "lucide-react-native";
import { CreatedBy } from "@/frontend/core/users/components/CreatedBy";
import { colors } from "@/frontend/constants/theme";

type PosterRowProps = {
  /** null = an official AnoUlam meal. */
  posterId: string | null | undefined;
  /** Opens the poster's profile (the official one for AnoUlam meals). */
  onPress?: () => void;
};

// "Who made this" under the reel's meal details. Tap to open the profile.
export function PosterRow({ posterId, onPress }: PosterRowProps) {
  if (!posterId) {
    return (
      <Pressable onPress={onPress} hitSlop={6} className="flex-row items-center gap-2 self-start">
        <Image source={require("@/assets/icon.png")} className="h-6 w-6 rounded-full" />
        <Text className="font-inter-semibold text-body text-white">AnoUlam</Text>
        <BadgeCheck color={colors.white} fill={colors.verified} size={16} />
      </Pressable>
    );
  }

  // A community recipe: the poster's real name and photo (CreatedBy loads
  // them; a guest sees "Community cook").
  return <CreatedBy posterId={posterId} onPress={onPress} />;
}
