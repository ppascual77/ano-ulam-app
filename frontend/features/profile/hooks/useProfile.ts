import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteMeal } from "@/api/meals";
import { listApprovedRecipesByPoster, listMyRecipes } from "@/api/recipes";
import { mealRowToMealType } from "@/frontend/core/meals/utils/mealAdapter";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import {
  getAccountSettings,
  getProfileExtras,
  markTourShown,
  updateBio,
  updateNewsletter,
  updatePrivacy,
  type AccountSettings,
  type ProfileExtras,
} from "../mock/api";
import { getUserProfile } from "../mock/users";

const profileKeys = {
  extras: ["profile", "extras"] as const,
  myRecipes: (posterId: string | null) => ["recipes", "mine", "list", posterId] as const,
};

// The signed-in user's display info, from the real session. Falls back the
// same way the web does (display name, then email, then "User").
export function useMe() {
  const { session } = useAuth();
  const meta = session?.user.user_metadata ?? {};
  return {
    id: session?.user.id ?? null,
    name:
      (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? session?.user.email ?? "User",
    avatarUrl: (meta.avatar_url as string | undefined) ?? (meta.picture as string | undefined) ?? null,
  };
}

export function useProfileExtras() {
  return useQuery({ queryKey: profileKeys.extras, queryFn: getProfileExtras });
}

export function useUpdateBio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateBio,
    onSuccess: (_, bio) =>
      queryClient.setQueryData<ProfileExtras>(profileKeys.extras, (prev) => (prev ? { ...prev, bio: bio || null } : prev)),
  });
}

// Real: the user's submitted recipes, every status.
export function useMyRecipes(posterId: string | null) {
  return useQuery({
    queryKey: profileKeys.myRecipes(posterId),
    queryFn: async () => (await listMyRecipes(posterId)).map((row) => mealRowToMealType(row)),
  });
}

export function useDeleteRecipe(posterId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMeal,
    // Also refreshes Add a Recipe's limit count (same "recipes, mine" prefix).
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["recipes", "mine"] }),
    onMutate: async (id) => {
      const key = profileKeys.myRecipes(posterId);
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData(key);
      queryClient.setQueryData<ReturnType<typeof mealRowToMealType>[]>(key, (prev) => prev?.filter((m) => m.id !== id));
      return { before };
    },
    onError: (_error, _id, context) => {
      if (context) queryClient.setQueryData(profileKeys.myRecipes(posterId), context.before);
    },
  });
}

// Someone else's profile (mock, see mock/users.ts). Errors with
// "unauthorized" for guests.
export function useUserProfile(userId: string, isGuest: boolean) {
  return useQuery({
    queryKey: ["profile", "user", userId, isGuest],
    queryFn: () => getUserProfile(userId, isGuest),
    retry: false,
  });
}

// Mock users have ids like "u2", which the uuid poster_id column rejects:
// only real ids are looked up.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Real: another user's approved recipes.
export function useApprovedRecipes(userId: string) {
  return useQuery({
    queryKey: ["recipes", "by-poster", userId],
    queryFn: async () =>
      UUID.test(userId) ? (await listApprovedRecipesByPoster(userId)).map((row) => mealRowToMealType(row)) : [],
  });
}

const settingsKey = ["profile", "settings"] as const;

export function useAccountSettings() {
  return useQuery({ queryKey: settingsKey, queryFn: getAccountSettings });
}

// Optimistic setters for the mock settings; errors are ignored (spec).
export function useAccountSettingsActions() {
  const queryClient = useQueryClient();
  const patch = (next: Partial<AccountSettings>) =>
    queryClient.setQueryData<AccountSettings>(settingsKey, (prev) => (prev ? { ...prev, ...next } : prev));
  return {
    setShowSaved: (show: boolean) => {
      patch({ show_saved_public: show });
      void updatePrivacy(show).catch(() => {});
    },
    setNewsletter: (on: boolean) => {
      patch({ newsletter_subscribed: on });
      void updateNewsletter(on).catch(() => {});
    },
    completeTour: (tourId: string) => {
      const current = queryClient.getQueryData<AccountSettings>(settingsKey);
      if (current && !current.tours_completed.includes(tourId)) {
        patch({ tours_completed: [...current.tours_completed, tourId] });
      }
      void markTourShown(tourId).catch(() => {});
    },
  };
}
