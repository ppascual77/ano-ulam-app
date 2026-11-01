import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteMeal } from "@/api/meals";
import { getPublicProfile } from "@/api/profiles";
import { listApprovedRecipesByPoster, listMyRecipes } from "@/api/recipes";
import { mealRowToMealType } from "@/frontend/core/meals/utils/mealAdapter";
import { listPublicSavedMeals } from "@/frontend/core/saved/savedMeals";
import type { SavedMeal } from "@/frontend/core/saved/types";
import type { UserProfile } from "@/api/auth";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { authKeys } from "@/frontend/features/auth/queryKeys";
import { useUpdateUserProfile, useUserProfile as useOwnUserRow } from "@/frontend/features/auth/hooks/useUserProfile";
import { getMockUserProfile } from "../mock/users";

export type PublicProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  show_saved_public: boolean;
  saved_meals: SavedMeal[];
};

const profileKeys = {
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

// The signed-in user's bio (users.bio).
export function useMyBio(): string | null {
  return useOwnUserRow().data?.bio ?? null;
}

export function useUpdateBio() {
  const update = useUpdateUserProfile();
  return { mutateAsync: (bio: string) => update.mutateAsync({ bio: bio.trim() || null }) };
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

// Mock users have ids like "u2", which the uuid columns reject: only real
// ids are looked up.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadPublicProfile(userId: string): Promise<PublicProfile> {
  const [row, saved] = await Promise.all([getPublicProfile(userId), listPublicSavedMeals(userId)]);
  return {
    id: userId,
    display_name: row?.display_name ?? null,
    avatar_url: row?.avatar_url ?? null,
    bio: row?.bio ?? null,
    show_saved_public: row?.show_saved_public ?? false,
    saved_meals: saved,
  };
}

// Someone else's profile: real for real users (recipe posters), through the
// public profile functions; the mock Community authors ("u2"...) keep their
// fixtures until the Community feed is real. Errors with "unauthorized" for
// guests.
export function useUserProfile(userId: string, isGuest: boolean) {
  return useQuery({
    queryKey: ["profile", "user", userId, isGuest],
    queryFn: async () => {
      if (isGuest) throw new Error("unauthorized");
      return UUID.test(userId) ? loadPublicProfile(userId) : getMockUserProfile(userId);
    },
    retry: false,
  });
}

// Real: another user's approved recipes.
export function useApprovedRecipes(userId: string) {
  return useQuery({
    queryKey: ["recipes", "by-poster", userId],
    queryFn: async () =>
      UUID.test(userId) ? (await listApprovedRecipesByPoster(userId)).map((row) => mealRowToMealType(row)) : [],
  });
}

export type AccountSettings = {
  show_saved_public: boolean;
  newsletter_subscribed: boolean;
};

// Privacy and newsletter, on the user's row (users.show_saved_public,
// users.newsletter_subscribed).
export function useAccountSettings(): { data: AccountSettings | undefined } {
  const row = useOwnUserRow().data;
  return {
    data: row ? { show_saved_public: row.show_saved_public, newsletter_subscribed: row.newsletter_subscribed } : undefined,
  };
}

// The toggle flips at once (the row's cache is patched first) and flips back
// if saving fails.
export function useAccountSettingsActions() {
  const queryClient = useQueryClient();
  const update = useUpdateUserProfile();
  const { session } = useAuth();
  const key = authKeys.userProfile(session?.user.id ?? "");
  const save = (next: Partial<AccountSettings>) => {
    const before = queryClient.getQueryData<UserProfile>(key);
    if (before) queryClient.setQueryData<UserProfile>(key, { ...before, ...next });
    update.mutate(next, { onError: () => before && queryClient.setQueryData(key, before) });
  };
  return {
    setShowSaved: (show: boolean) => save({ show_saved_public: show }),
    setNewsletter: (on: boolean) => save({ newsletter_subscribed: on }),
  };
}
