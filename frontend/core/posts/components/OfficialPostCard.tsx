import { Linking, Pressable, Text, View } from "react-native";
import { ArrowRight, Share2 } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { PostAuthor, PostCaption, PostPhoto } from "./PostParts";

export const WEB_APP_URL = "https://anoulam.app";

export type OfficialPost = {
  image: number;
  caption: string;
  guideLabel: string;
  guideRoute: string;
};

// Copy verbatim from the web app's OfficialPostCard.tsx. Shown after the
// community list ends. The guides live on the web app (no guide screens in
// mobile yet), so the CTA opens them there.
export const OFFICIAL_POSTS: OfficialPost[] = [
  {
    image: require("@/assets/discover/high_prot.jpg"),
    caption:
      "Want to build muscle without giving up Filipino food? We put together a guide on high-protein ulam that's actually masarap. 💪",
    guideLabel: "View High Protein Guide",
    guideRoute: "/guides/high-protein",
  },
  {
    image: require("@/assets/discover/budget.jpg"),
    caption:
      "Luto ng masarap kahit tipid ang budget. Our Budget Meals Guide has ulam ideas under ₱150 that the whole family will love. 🍳",
    guideLabel: "View Budget Meals Guide",
    guideRoute: "/guides/budget-meals",
  },
];

type OfficialPostCardProps = {
  post: OfficialPost;
  onShare: () => void;
  onOpenPhoto: (image: number) => void;
  /** Tapping "AnoUlam" (opens the official profile). */
  onPressAuthor?: () => void;
};

// Same layout as FoodPostCard, authored by AnoUlam, with a guide link.
// Share only, no like.
export function OfficialPostCard({ post, onShare, onOpenPhoto, onPressAuthor }: OfficialPostCardProps) {
  return (
    <View className="border-b border-web-divider pb-3">
      <PostAuthor name="AnoUlam" official onPress={onPressAuthor} />
      <PostCaption text={post.caption} />
      <Pressable
        onPress={() => Linking.openURL(`${WEB_APP_URL}${post.guideRoute}`)}
        className="mt-2.5 flex-row items-center gap-1.5 self-start px-4"
      >
        <Text className="font-inter-semibold text-small text-brand-green">{post.guideLabel}</Text>
        <ArrowRight color={colors.brandGreen.DEFAULT} size={12} />
      </Pressable>
      <PostPhoto source={post.image} onPress={() => onOpenPhoto(post.image)} />
      <View className="mt-2.5 flex-row px-4">
        <Pressable onPress={onShare} hitSlop={8} accessibilityLabel="Share">
          <Share2 color={colors.webInk.muted} size={16} />
        </Pressable>
      </View>
    </View>
  );
}
