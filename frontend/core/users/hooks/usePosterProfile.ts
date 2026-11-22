import { useQuery } from "@tanstack/react-query";
import { getPublicProfile } from "@/api/profiles";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";

export type PosterProfile = { displayName: string | null; avatarUrl: string | null };

/** Who made a community recipe, for its "Created by" (the web app's
 *  usePosterProfile). Through get_public_profile, so signed-in only: a guest
 *  gets null (callers show "Community cook"). undefined while loading, null
 *  when there's no poster or no profile to show. */
export function usePosterProfile(posterId: string | null | undefined): PosterProfile | null | undefined {
  const { isSignedIn } = useAuth();
  const enabled = !!posterId && isSignedIn;
  const query = useQuery({
    queryKey: ["poster", posterId],
    queryFn: async () => {
      const row = await getPublicProfile(posterId!);
      return row ? { displayName: row.display_name ?? null, avatarUrl: row.avatar_url ?? null } : null;
    },
    enabled,
    staleTime: 10 * 60 * 1000,
  });
  if (!enabled) return null;
  return query.isLoading ? undefined : (query.data ?? null);
}
