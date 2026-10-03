import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { ChefHat } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { MealCard } from "@/frontend/core/meals/components/card/MealCard";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { FoodPostCard } from "@/frontend/core/posts/components/FoodPostCard";
import { ImageLightbox } from "@/frontend/core/posts/components/ImageLightbox";
import { PostSkeleton } from "@/frontend/core/posts/components/PostSkeleton";
import { WEB_APP_URL } from "@/frontend/core/posts/components/OfficialPostCard";
import { MOCK_ME_ID } from "@/frontend/core/posts/mock/posts";
import { useApprovedRecipes } from "../../hooks/useProfile";
import { useUserPosts } from "../../hooks/useUserPosts";
import { useMealDetail } from "../../hooks/useMealDetail";
import { MealGrid } from "../MealGrid";
import { MealGridSkeleton } from "../MealGridSkeleton";
import { EmptyState } from "../EmptyState";

type VisitorCreatedTabProps = {
  userId: string;
  /** Bumped near the bottom of the screen: load more posts. */
  loadMoreSignal: number;
  onToast: (message: string, tone: "success" | "error") => void;
};

// Someone else's published recipes (like + save into the viewer's list)
// and their food posts, with no owner menus.
export function VisitorCreatedTab({ userId, loadMoreSignal, onToast }: VisitorCreatedTabProps) {
  const recipesQuery = useApprovedRecipes(userId);
  const recipes = recipesQuery.data ?? [];
  // Same paged list as the own profile, for this user's id.
  const posts = useUserPosts(userId);
  const detail = useMealDetail();
  const [lightbox, setLightbox] = useState<{ uri: string } | null>(null);

  useEffect(() => {
    if (loadMoreSignal > 0) void posts.loadMore();
    // Only on a new signal.
  }, [loadMoreSignal]);

  const share = async (postId: string) => {
    await Clipboard.setStringAsync(`${WEB_APP_URL}/community/post/${postId}`);
    onToast("Copied to clipboard", "success");
  };

  const isEmpty = !recipesQuery.isLoading && !posts.loading && recipes.length === 0 && posts.posts.length === 0;

  return (
    <View className="gap-8 pb-6">
      {isEmpty && (
        <EmptyState
          Icon={ChefHat}
          iconColor={colors.webInk.muted}
          badge={false}
          title="No recipes yet"
          body="This user hasn't published any recipes yet."
        />
      )}

      {(recipesQuery.isLoading || recipes.length > 0) && (
        <View className="gap-5">
          <Text className="font-inter-semibold text-subheading text-web-ink-body">Recipes</Text>
          {recipesQuery.isLoading ? (
            <MealGridSkeleton />
          ) : (
            <MealGrid
              items={recipes}
              keyOf={(meal) => meal.id ?? meal.name}
              renderItem={(meal, width) => (
                <MealCard
                  meal={meal}
                  width={width}
                  layout="grid"
                  onPress={() => detail.open(meal.id)}
                  onSaveError={(message) => onToast(message, "error")}
                />
              )}
            />
          )}
        </View>
      )}

      {(posts.loading || posts.posts.length > 0) && !isEmpty && (
        <View className="gap-4">
          <Text className="font-inter-semibold text-subheading text-web-ink-soft">Food Posts</Text>
          {posts.loading ? (
            <View>
              <PostSkeleton />
              <PostSkeleton />
            </View>
          ) : (
            <View className="gap-6">
              {posts.posts.map((post) => (
                <FoodPostCard
                  key={post.id}
                  post={post}
                  currentUserId={MOCK_ME_ID}
                  onLike={() => void posts.toggleLike(post)}
                  onShare={() => void share(post.id)}
                  onOpenPhoto={(uri) => setLightbox({ uri })}
                />
              ))}
              {posts.loadingMore && <PostSkeleton />}
            </View>
          )}
        </View>
      )}

      <MealDetailSheet meal={detail.meal} onClose={detail.close} onNotify={onToast} />
      <ImageLightbox source={lightbox} onClose={() => setLightbox(null)} />
    </View>
  );
}
