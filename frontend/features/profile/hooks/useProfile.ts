import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteMeal } from "@/api/meals";
import { getPublicProfile } from "@/api/profiles";
import { listApprovedRecipesByPoster, listMyRecipes } from "@/api/recipes";
import { mealRowToMealType } from "@/frontend/core/meals/utils/mealAdapter";
import { listPublicSavedMeals } from "@/frontend/core/saved/savedMeals";
import type { SavedMeal } from "@/frontend/core/saved/types";
import { removeAvatar, uploadAvatar, type PickedPhoto, type UserProfile } from "@/api/auth";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { authKeys } from "@/frontend/features/auth/queryKeys";
import {
  useMyAvatarUrl,
  useUpdateUserProfile,
  useUserProfile as useOwnUserRow,
} from "@/frontend/features/auth/hooks/useUserProfile";

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
  const avatarUrl = useMyAvatarUrl();
  return {
    id: session?.user.id ?? null,
    name:
      (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? session?.user.email ?? "User",
    avatarUrl,
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

// Change or remove the signed-in user's photo. The row's cache takes the new
// avatar_url at once, and post lists refetch so your posts show it too.
export function useAvatarActions() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const current = useMyAvatarUrl();
  const onSuccess = (row: UserProfile) => {
    queryClient.setQueryData(authKeys.userProfile(row.id), row);
    void queryClient.invalidateQueries({ queryKey: ["posts"] });
  };
  const upload = useMutation({
    mutationFn: (photo: PickedPhoto) => {
      if (!userId) throw new Error("Not signed in");
      return uploadAvatar(userId, photo, current);
    },
    onSuccess,
  });
  const remove = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error("Not signed in");
      return removeAvatar(userId, current);
    },
    onSuccess,
  });
  return { upload, remove, busy: upload.isPending || remove.isPending };
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

// Only real ids are looked up: anything else would be rejected by the uuid
// columns.
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

// Someone else's profile (recipe posters, post authors), through the public
// profile functions. Errors with "unauthorized" for guests; a malformed id
// reads as a user with nothing public.
export function useUserProfile(userId: string, isGuest: boolean) {
  return useQuery({
    queryKey: ["profile", "user", userId, isGuest],
    queryFn: async () => {
      if (isGuest) throw new Error("unauthorized");
      return UUID.test(userId)
        ? loadPublicProfile(userId)
        : { id: userId, display_name: null, avatar_url: null, bio: null, show_saved_public: false, saved_meals: [] };
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
