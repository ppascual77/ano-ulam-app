import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Heart, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react-native";
import { Confetti, Dropdown, useBurstOnActivate } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { FoodPost } from "@/frontend/core/posts/mock/posts";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { PostAuthor, PostCaption, PostPhoto } from "./PostParts";

type FoodPostCardProps = {
  post: FoodPost;
  currentUserId: string | null;
  onLike: () => void;
  onShare: () => void;
  onOpenPhoto: (uri: string) => void;
  /** Own posts only: the "..." menu shows when these are passed. */
  onEdit?: () => void;
  onDelete?: () => void;
  /** Tapping the author (opens their profile). */
  onPressAuthor?: () => void;
};

// One community post: author, caption, then whichever attachment it has
// (link preview, GIF, sticker, photo), then like + share.
export function FoodPostCard({ post, currentUserId, onLike, onShare, onOpenPhoto, onEdit, onDelete, onPressAuthor }: FoodPostCardProps) {
  const liked = !!currentUserId && post.liked_by.includes(currentUserId);
  const likeCount = post.liked_by.length;
  // Hearts burst when a like lands (not on unlike, not on first render).
  const likeBurstId = useBurstOnActivate(liked);

  const menuItems = [
    ...(onEdit ? [{ label: "Edit", icon: <Pencil color={colors.webInk.soft} size={12} />, onPress: onEdit }] : []),
    ...(onDelete
      ? [{ label: "Delete", icon: <Trash2 color={colors.like} size={12} />, onPress: onDelete, destructive: true }]
      : []),
  ];

  return (
    <View className="border-b border-web-divider pb-3">
      <PostAuthor
        name={post.display_name ?? "User"}
        avatarUrl={post.avatar_url}
        official={post.is_official}
        onPress={onPressAuthor}
        trailing={
          menuItems.length > 0 && (
            <Dropdown
              trigger={
                <View className="p-1">
                  <MoreHorizontal color={colors.webInk.muted} size={16} />
                </View>
              }
              items={menuItems}
            />
          )
        }
      />

      {!!post.caption && <PostCaption text={post.caption} />}

      {post.link_url && (
        <View className="mx-4 mt-2.5">
          <LinkPreviewCard
            url={post.link_url}
            title={post.link_title}
            description={post.link_description}
            image={post.link_image}
          />
        </View>
      )}

      {post.gif_url && (
        <View className="mx-4 mt-2.5 overflow-hidden rounded-2xl">
          <Image source={{ uri: post.gif_url }} style={{ width: "100%", aspectRatio: 4 / 3 }} contentFit="cover" />
        </View>
      )}

      {post.sticker_url && (
        <View className="mt-2.5 items-center">
          <Image source={{ uri: post.sticker_url }} style={{ width: 128, height: 128 }} contentFit="contain" />
        </View>
      )}

      {post.image_url && <PostPhoto source={{ uri: post.image_url }} onPress={() => onOpenPhoto(post.image_url as string)} />}

      <View className="mt-2.5 flex-row items-center gap-4 px-4">
        <Pressable onPress={onLike} hitSlop={8} className="flex-row items-center gap-1.5">
          <View>
            {/* "up": this heart sits at the post's left edge, so the default
                up-left fan would send most pieces off-screen. */}
            <Confetti burstId={likeBurstId} icon={Heart} color={colors.like} direction="up" />
            <Heart
              color={liked ? colors.like : colors.webInk.muted}
              fill={liked ? colors.like : "none"}
              size={16}
            />
          </View>
          {likeCount > 0 && (
            <Text className={`font-inter-regular text-small ${liked ? "text-like" : "text-web-ink-muted"}`}>
              {likeCount}
            </Text>
          )}
        </Pressable>
        <Pressable onPress={onShare} hitSlop={8} accessibilityLabel="Share">
          <Share2 color={colors.webInk.muted} size={16} />
        </Pressable>
      </View>
    </View>
  );
}
