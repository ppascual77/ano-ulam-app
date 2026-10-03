import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { ChefHat, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react-native";
import { ConfirmSheet, Dropdown } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { getMeal } from "@/api/meals";
import { MealCard } from "@/frontend/core/meals/components/card/MealCard";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { mealRowToMealType } from "@/frontend/core/meals/utils/mealAdapter";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { FoodPostCard } from "@/frontend/core/posts/components/FoodPostCard";
import { ImageLightbox } from "@/frontend/core/posts/components/ImageLightbox";
import { PostSkeleton } from "@/frontend/core/posts/components/PostSkeleton";
import { WEB_APP_URL } from "@/frontend/core/posts/components/OfficialPostCard";
import { MOCK_ME_ID, type FoodPost } from "@/frontend/core/posts/mock/posts";
import { useDeleteRecipe, useMyRecipes } from "../../hooks/useProfile";
import { useUserPosts } from "../../hooks/useUserPosts";
import { useLastDefined } from "../../hooks/useLastDefined";
import { MealGrid } from "../MealGrid";
import { MealGridSkeleton } from "../MealGridSkeleton";
import { EmptyState } from "../EmptyState";
import { RecipeStatusBadge } from "../CardOverlays";

type CreatedTabProps = {
  posterId: string | null;
  /** False at the recipe limit: the "+" is dimmed and inert. */
  canCreate: boolean;
  onCreate: () => void;
  onEditPost: (post: FoodPost) => void;
  /** Bump to reload the posts from the top. */
  postsRefreshKey: number;
  /** Bumped by the screen's scroll view near the bottom: load more posts. */
  loadMoreSignal: number;
  onToast: (message: string, tone: "success" | "error") => void;
};

// The recipe editor doesn't exist yet (Add a Recipe only creates).
const EDIT_COMING_SOON = "Editing recipes is coming soon";

function OwnerMenu({ status, onEdit, onDelete }: { status?: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <Dropdown
      trigger={
        <View className="h-6 w-6 items-center justify-center rounded-full bg-black/40">
          <MoreVertical color={colors.white} size={11} />
        </View>
      }
      items={[
        // A rejected recipe can only be deleted.
        ...(status === "rejected"
          ? []
          : [{ label: "Edit", icon: <Pencil color={colors.webInk.muted} size={12} />, onPress: onEdit }]),
        { label: "Delete", icon: <Trash2 color={colors.like} size={12} />, onPress: onDelete, destructive: true },
      ]}
    />
  );
}

function SectionHeader({ title, onCreate, canCreate }: { title: string; onCreate?: () => void; canCreate: boolean }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="font-inter-semibold text-subheading text-web-ink-body">{title}</Text>
      {onCreate && (
        <Pressable
          onPress={onCreate}
          disabled={!canCreate}
          accessibilityLabel="Create"
          className={`h-10 w-10 items-center justify-center ${canCreate ? "" : "opacity-30"}`}
        >
          <Plus color={colors.webInk.body} size={28} strokeWidth={1.5} />
        </Pressable>
      )}
    </View>
  );
}

// Owner's recipes (every status, with badges and an Edit/Delete menu) and
// food posts (paged, owner menu on each).
export function CreatedTab({ posterId, canCreate, onCreate, onEditPost, postsRefreshKey, loadMoreSignal, onToast }: CreatedTabProps) {
  const recipesQuery = useMyRecipes(posterId);
  const recipes = recipesQuery.data ?? [];
  const deleteRecipe = useDeleteRecipe(posterId);
  const posts = useUserPosts(MOCK_ME_ID, { refreshKey: postsRefreshKey });
  const [lightbox, setLightbox] = useState<{ uri: string } | null>(null);

  useEffect(() => {
    if (loadMoreSignal > 0) void posts.loadMore();
    // Only on a new signal.
  }, [loadMoreSignal]);

  // Meal Details for a recipe: fetched with its ingredients on open.
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailQuery = useQuery({
    queryKey: ["meals", "profile-detail", detailId],
    queryFn: () => getMeal(detailId as string),
    enabled: !!detailId,
  });
  const detailMeal = detailId && detailQuery.data ? mealRowToMealType(detailQuery.data, detailQuery.data.meal_ingredients) : null;

  const [confirmLive, setConfirmLive] = useState<MealType | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ meal: MealType; fromDetails: boolean } | null>(null);
  // Set when Meal Details asks to delete: the confirm opens once it closes.
  const deleteAfterDetails = useRef<MealType | null>(null);
  const editAfterLive = useRef(false);
  const liveName = useLastDefined(confirmLive?.name);
  const deleteTarget = useLastDefined(confirmDelete);

  const edit = (meal: MealType) => {
    if (meal.status === "approved") setConfirmLive(meal);
    else onToast(EDIT_COMING_SOON, "success");
  };

  const runDelete = async () => {
    if (!confirmDelete?.meal.id) return;
    try {
      await deleteRecipe.mutateAsync(confirmDelete.meal.id);
    } catch {
      onToast("Couldn't delete this recipe. Please try again.", "error");
    }
    setConfirmDelete(null);
  };

  const share = async (post: FoodPost) => {
    await Clipboard.setStringAsync(`${WEB_APP_URL}/community/post/${post.id}`);
    onToast("Copied to clipboard", "success");
  };

  const isEmpty = !recipesQuery.isLoading && !posts.loading && recipes.length === 0 && posts.posts.length === 0;

  return (
    <View className="gap-8 pb-6">
      {isEmpty && (
        <EmptyState
          Icon={ChefHat}
          iconColor={colors.brandGreen.DEFAULT}
          title="Nothing here yet"
          body="Post a photo of what you ate, or share a recipe with the community."
          action={{ label: "Create", Icon: Plus, onPress: onCreate }}
        />
      )}

      {recipesQuery.isLoading && (
        <View className="gap-5">
          <SectionHeader title="My Recipes" canCreate={canCreate} />
          <MealGridSkeleton />
        </View>
      )}

      {recipes.length > 0 && (
        <View className="gap-5">
          <SectionHeader title="My Recipes" onCreate={onCreate} canCreate={canCreate} />
          <MealGrid
            items={recipes}
            keyOf={(meal) => meal.id ?? meal.name}
            renderItem={(meal, width) => {
              const live = !meal.status || meal.status === "approved";
              return (
                <MealCard
                  meal={meal}
                  width={width}
                  layout="grid"
                  onPress={() => setDetailId(meal.id ?? null)}
                  hideActions={!live}
                  dimmed={meal.status === "rejected"}
                  topLeft={live ? undefined : <RecipeStatusBadge status={meal.status} reason={meal.rejection_reason} />}
                  topRight={
                    <OwnerMenu
                      status={meal.status}
                      onEdit={() => edit(meal)}
                      onDelete={() => setConfirmDelete({ meal, fromDetails: false })}
                    />
                  }
                  onSaveError={(message) => onToast(message, "error")}
                />
              );
            }}
          />
        </View>
      )}

      {(posts.loading || posts.posts.length > 0) && !isEmpty && (
        <View className="gap-4">
          <SectionHeader
            title="Food Posts"
            // The "+" moves here when there are no recipes to sit beside.
            onCreate={recipes.length === 0 && !recipesQuery.isLoading ? onCreate : undefined}
            canCreate={canCreate}
          />
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
                  onShare={() => void share(post)}
                  onOpenPhoto={(uri) => setLightbox({ uri })}
                  onEdit={() => onEditPost(post)}
                  onDelete={() => void posts.remove(post)}
                />
              ))}
              {posts.loadingMore && <PostSkeleton />}
            </View>
          )}
        </View>
      )}

      <MealDetailSheet
        meal={detailMeal}
        onClose={() => setDetailId(null)}
        onClosed={() => {
          const meal = deleteAfterDetails.current;
          deleteAfterDetails.current = null;
          if (meal) setConfirmDelete({ meal, fromDetails: true });
        }}
        onNotify={onToast}
        recipeOwner={
          detailMeal
            ? {
                onEditRecipe: () => {
                  setDetailId(null);
                  onToast(EDIT_COMING_SOON, "success");
                },
                onDeleteRecipe: () => {
                  deleteAfterDetails.current = detailMeal;
                  setDetailId(null);
                },
              }
            : undefined
        }
      />

      <ConfirmSheet
        visible={!!confirmLive}
        title="This recipe is live"
        body={
          <Text className="mt-1 text-center font-inter-regular text-body text-web-ink-muted">
            <Text className="font-inter-medium text-web-ink-soft">{liveName}</Text> is currently visible to all users.
            Editing it will move it back to review and it won't be shown publicly until approved again.
          </Text>
        }
        confirmLabel="Edit Anyway"
        tone="primary"
        onCancel={() => setConfirmLive(null)}
        onConfirm={() => {
          editAfterLive.current = true;
          setConfirmLive(null);
        }}
        // The editor isn't built yet: say so once the confirm is gone.
        onClosed={() => {
          if (editAfterLive.current) onToast(EDIT_COMING_SOON, "success");
          editAfterLive.current = false;
        }}
      />

      <ConfirmSheet
        visible={!!confirmDelete}
        icon={
          deleteTarget?.fromDetails ? (
            <View className="h-12 w-12 items-center justify-center rounded-full bg-like-soft">
              <Trash2 color={colors.like} size={20} />
            </View>
          ) : undefined
        }
        title="Delete this recipe?"
        body={
          <Text className="mt-1 text-center font-inter-regular text-body text-web-ink-muted">
            <Text className="font-inter-medium text-web-ink-soft">{deleteTarget?.meal.name}</Text> will be permanently
            removed. This cannot be undone.
          </Text>
        }
        confirmLabel={deleteRecipe.isPending ? "Deleting…" : "Delete"}
        busy={deleteRecipe.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={runDelete}
      />

      <ImageLightbox source={lightbox} onClose={() => setLightbox(null)} />
    </View>
  );
}
