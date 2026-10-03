import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { ConfirmSheet } from "@/frontend/components/ui";
import { useCommunityFeed } from "../hooks/useCommunityFeed";
import type { FoodPost } from "@/frontend/core/posts/mock/posts";
import { FoodPostCard } from "@/frontend/core/posts/components/FoodPostCard";
import { OFFICIAL_POSTS, OfficialPostCard, WEB_APP_URL } from "@/frontend/core/posts/components/OfficialPostCard";
import { ImageLightbox } from "@/frontend/core/posts/components/ImageLightbox";
import { PostSkeleton } from "@/frontend/core/posts/components/PostSkeleton";
import { openProfile } from "@/frontend/core/users/openProfile";

type CommunityFeedProps = {
  isGuest: boolean;
  currentUserId: string | null;
  /** Space reserved above the list for the header + tabs. */
  topInset: number;
  onLogIn: () => void;
  onToast: (message: string, tone?: "success" | "error") => void;
  /** Opens the composer to edit one of your posts. */
  onEditPost: (post: FoodPost) => void;
  /** Bump to reload from the top (after a post is created or edited). */
  refreshKey: number;
};

// Community tab body: a white, vertically scrolling feed of food posts,
// paged by 5, with AnoUlam's official posts appended once the list ends.
// Guests get a join prompt instead.
export function CommunityFeed({
  isGuest,
  currentUserId,
  topInset,
  onLogIn,
  onToast,
  onEditPost,
  refreshKey,
}: CommunityFeedProps) {
  const feed = useCommunityFeed({ enabled: !isGuest, userId: currentUserId, refreshKey });
  const [confirmPost, setConfirmPost] = useState<FoodPost | null>(null);
  const [lightbox, setLightbox] = useState<{ uri: string } | number | null>(null);

  const share = async (path: string) => {
    await Clipboard.setStringAsync(`${WEB_APP_URL}${path}`);
    onToast("Copied to clipboard", "success");
  };

  if (isGuest) {
    return (
      <View className="flex-1 items-center justify-center gap-5 px-8" style={{ paddingTop: topInset }}>
        <View className="h-16 w-16 items-center justify-center rounded-full bg-web-divider">
          <Text className="text-heading">🍽️</Text>
        </View>
        <View className="items-center">
          <Text className="mb-1 font-inter-bold text-subheading text-web-ink">Join the Community</Text>
          <Text className="text-center font-inter-regular text-body text-web-ink-muted">
            Log in to see and share food posts from the community.
          </Text>
        </View>
        <View className="w-full gap-2">
          <Pressable onPress={onLogIn} className="items-center rounded-2xl bg-brand-green py-3">
            <Text className="font-inter-semibold text-body text-white">Log in</Text>
          </Pressable>
          {/* Google sign-in covers both new and returning users. */}
          <Pressable onPress={onLogIn} className="items-center rounded-2xl border border-web-divider py-3">
            <Text className="font-inter-medium text-body text-web-ink-soft">Create account</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (feed.loading) {
    return (
      <View className="flex-1" style={{ paddingTop: topInset }}>
        <PostSkeleton />
        <PostSkeleton />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={feed.posts}
        keyExtractor={(post) => post.id}
        contentContainerStyle={{ paddingTop: topInset, paddingBottom: 24 }}
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.5}
        renderItem={({ item: post }) => {
          const isOwn = !!currentUserId && post.user_id === currentUserId;
          return (
            <FoodPostCard
              post={post}
              currentUserId={currentUserId}
              onLike={() => feed.toggleLike(post)}
              onShare={() => share(`/community/post/${post.id}`)}
              onOpenPhoto={(uri) => setLightbox({ uri })}
              onEdit={isOwn ? () => onEditPost(post) : undefined}
              onDelete={isOwn ? () => setConfirmPost(post) : undefined}
              onPressAuthor={() => openProfile(post.is_official ? null : post.user_id, currentUserId)}
            />
          );
        }}
        ListEmptyComponent={
          <View className="items-center px-5 py-16">
            <Text className="mb-1 font-inter-semibold text-subheading text-web-ink">No posts yet</Text>
            <Text className="font-inter-regular text-body text-web-ink-muted">Be the first to share a food photo!</Text>
          </View>
        }
        ListFooterComponent={
          feed.hasMore ? (
            // The next page's placeholder, while it loads.
            <View className="pb-4">{feed.loadingMore && <PostSkeleton />}</View>
          ) : (
            // The list has ended: AnoUlam's official posts close it out.
            <View>
              {OFFICIAL_POSTS.map((post) => (
                <OfficialPostCard
                  key={post.guideRoute}
                  post={post}
                  onShare={() => share(post.guideRoute)}
                  onOpenPhoto={(image) => setLightbox(image)}
                  onPressAuthor={() => openProfile(null, currentUserId)}
                />
              ))}
            </View>
          )
        }
      />

      <ConfirmSheet
        visible={!!confirmPost}
        title="Delete this post?"
        body="This cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirmPost(null)}
        onConfirm={() => {
          if (confirmPost) void feed.remove(confirmPost);
          setConfirmPost(null);
        }}
      />

      <ImageLightbox source={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
}
