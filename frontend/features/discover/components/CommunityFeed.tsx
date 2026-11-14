import { useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import * as Clipboard from "expo-clipboard";
import { ConfirmSheet } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { FoodPost } from "@/api/posts";
import { usePostList } from "@/frontend/core/posts/hooks/usePosts";
import { usePostModeration } from "@/frontend/core/posts/hooks/usePostModeration";
import { FoodPostCard } from "@/frontend/core/posts/components/FoodPostCard";
import { OFFICIAL_POSTS, OfficialPostCard, WEB_APP_URL } from "@/frontend/core/posts/components/OfficialPostCard";
import { ImageLightbox } from "@/frontend/core/posts/components/ImageLightbox";
import { PostSkeleton } from "@/frontend/core/posts/components/PostSkeleton";
import { openProfile } from "@/frontend/core/users/openProfile";
import { SignInButtons } from "@/frontend/features/auth/components/SignInButtons";
import type { SignInProvider } from "@/frontend/features/auth/hooks/useAuth";

type CommunityFeedProps = {
  isGuest: boolean;
  currentUserId: string | null;
  /** Space reserved above the list for the header + tabs. */
  topInset: number;
  onLogIn: (provider: SignInProvider) => void;
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
  const feed = usePostList({ userId: null, enabled: !isGuest, pageSize: 5, refreshKey });
  const [confirmPost, setConfirmPost] = useState<FoodPost | null>(null);
  // Report (others' posts) and admin Remove, in each card's menu.
  const moderation = usePostModeration(feed, currentUserId, (message, tone) => onToast(message, tone));
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
        {/* Signing in also creates the account, so no separate sign-up. */}
        <View className="w-full">
          <SignInButtons onSignIn={onLogIn} />
        </View>
      </View>
    );
  }

  if (feed.error) {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-8" style={{ paddingTop: topInset }}>
        <Text className="text-center font-inter-regular text-body text-web-ink-muted">
          Couldn't load the community feed.
        </Text>
        <Pressable onPress={feed.retry} className="rounded-2xl border border-web-divider px-5 py-2.5">
          <Text className="font-inter-medium text-body text-web-ink-soft">Try again</Text>
        </Pressable>
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
        refreshControl={
          <RefreshControl
            refreshing={feed.refreshing}
            onRefresh={feed.refresh}
            tintColor={colors.webInk.muted}
            progressViewOffset={topInset}
          />
        }
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
              {...moderation.actionsFor(post)}
              onPressAuthor={() => openProfile(post.user_id, currentUserId)}
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

      {moderation.sheets}
      <ConfirmSheet
        visible={!!confirmPost}
        title="Delete this post?"
        body="This cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirmPost(null)}
        onConfirm={() => {
          if (confirmPost) {
            void feed.remove(confirmPost).then((ok) => {
              if (!ok) onToast("Couldn't delete your post. Please try again.");
            });
          }
          setConfirmPost(null);
        }}
      />

      <ImageLightbox source={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
}
