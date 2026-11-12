import { useCallback, useEffect, useRef } from "react";
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import {
  countUserPosts,
  createPost,
  deletePost,
  listCommunityPosts,
  listUserPosts,
  reportPost,
  setPostLiked,
  updatePost,
  type FoodPost,
  type PostInput,
  type ReportReason,
} from "@/api/posts";
import { removePost } from "@/api/moderation";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { postKeys } from "../queryKeys";
import { proKeys } from "@/frontend/core/pro/queryKeys";
import { useProStore } from "@/frontend/core/pro/store/useProStore";

type Pages = InfiniteData<FoodPost[], number>;

// Applies `change` to every cached post list (the feed and any profile), so a
// like or delete shows the same everywhere.
function patchAllLists(queryClient: QueryClient, viewerId: string | null, change: (posts: FoodPost[]) => FoodPost[]) {
  queryClient.setQueriesData<Pages>({ queryKey: postKeys.all(viewerId) }, (data) =>
    data ? { ...data, pages: data.pages.map(change) } : data,
  );
}

// Likes on one post are sent in order, so a quick like-unlike can't land
// backwards.
const likeQueues = new Map<string, Promise<unknown>>();

type PostListOptions = {
  /** null = the Community feed; a user id = that user's posts. */
  userId: string | null;
  enabled?: boolean;
  pageSize: number;
  /** Bump to reload from the top. */
  refreshKey?: number;
};

// A paged post list (the Community feed, or a profile's Food Posts), with
// optimistic like and delete. Page n starts after everything loaded so far.
export function usePostList({ userId, enabled = true, pageSize, refreshKey = 0 }: PostListOptions) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const viewerId = session?.user.id ?? null;
  const queryKey = userId ? postKeys.user(viewerId, userId) : postKeys.feed(viewerId);

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => (userId ? listUserPosts(userId, pageParam, pageSize) : listCommunityPosts(pageParam, pageSize)),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length < pageSize ? undefined : all.reduce((n, page) => n + page.length, 0)),
    // Signed-in only (the database function refuses guests).
    enabled: enabled && !!viewerId,
  });

  // A new refreshKey drops the loaded pages and starts again from the top.
  const firstKey = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey === firstKey.current) return;
    firstKey.current = refreshKey;
    void queryClient.resetQueries({ queryKey });
    // queryKey is rebuilt every render; refreshKey is the trigger.
  }, [refreshKey]);

  const posts = query.data?.pages.flat() ?? [];

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage && !query.isLoading) void query.fetchNextPage();
  }, [query.hasNextPage, query.isFetchingNextPage, query.isLoading, query.fetchNextPage]);

  // Optimistic; flips back if it doesn't save.
  const toggleLike = async (post: FoodPost) => {
    if (!viewerId) return;
    const liked = !post.liked;
    const set = (to: boolean) =>
      patchAllLists(queryClient, viewerId, (list) =>
        list.map((p) =>
          p.id === post.id && p.liked !== to ? { ...p, liked: to, like_count: Math.max(0, p.like_count + (to ? 1 : -1)) } : p,
        ),
      );
    set(liked);
    const previous = likeQueues.get(post.id) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() => setPostLiked(post.id, liked));
    likeQueues.set(post.id, next);
    try {
      await next;
    } catch {
      set(!liked);
    } finally {
      if (likeQueues.get(post.id) === next) likeQueues.delete(post.id);
    }
  };

  // Removed from every list at once. Resolves false (and puts it back) if the
  // delete didn't go through.
  const remove = async (post: FoodPost): Promise<boolean> => {
    patchAllLists(queryClient, viewerId, (list) => list.filter((p) => p.id !== post.id));
    try {
      await deletePost(post);
      void queryClient.invalidateQueries({ queryKey: postKeys.count(post.user_id) });
      return true;
    } catch {
      void queryClient.invalidateQueries({ queryKey: postKeys.all(viewerId) });
      return false;
    }
  };

  // Reporting: the post leaves this viewer's lists right away (the feed
  // stops returning it to them too). Resolves false, putting it back, if the
  // report didn't go through.
  const report = async (post: FoodPost, reason: ReportReason, note?: string): Promise<boolean> => {
    patchAllLists(queryClient, viewerId, (list) => list.filter((p) => p.id !== post.id));
    try {
      await reportPost(post.id, reason, note);
      return true;
    } catch {
      void queryClient.invalidateQueries({ queryKey: postKeys.all(viewerId) });
      return false;
    }
  };

  // Admin: hidden for everyone (moderation, not a delete). Same shape.
  const adminRemove = async (post: FoodPost): Promise<boolean> => {
    patchAllLists(queryClient, viewerId, (list) => list.filter((p) => p.id !== post.id));
    try {
      await removePost(post.id);
      return true;
    } catch {
      void queryClient.invalidateQueries({ queryKey: postKeys.all(viewerId) });
      return false;
    }
  };

  return {
    posts,
    loading: query.isLoading,
    error: query.isError && posts.length === 0,
    loadingMore: query.isFetchingNextPage,
    hasMore: !!query.hasNextPage,
    refreshing: query.isRefetching && !query.isFetchingNextPage,
    refresh: () => void query.refetch(),
    retry: () => void queryClient.resetQueries({ queryKey }),
    loadMore,
    toggleLike,
    remove,
    report,
    adminRemove,
  };
}

// Creates or edits a post, then reloads every post list from the top (so a
// new post shows first).
export function useSavePost() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const viewerId = session?.user.id ?? null;
  return async (input: PostInput, editing: FoodPost | null) => {
    if (editing) await updatePost(editing, input);
    else await createPost(input);
    await queryClient.resetQueries({ queryKey: postKeys.all(viewerId) });
    if (!editing && viewerId) void queryClient.invalidateQueries({ queryKey: postKeys.count(viewerId) });
    // A first photo post earns Pro days (granted by the database): pick up
    // the claimed reward and the new Pro straight away.
    if (!editing && input.image_uri) {
      void queryClient.invalidateQueries({ queryKey: proKeys.all });
      useProStore.getState().refresh();
    }
  };
}

// How many posts a user has made (a profile's stats row). Refreshed after
// creating or deleting a post.
export function usePostCount(userId: string | null) {
  return useQuery({
    queryKey: postKeys.count(userId ?? ""),
    queryFn: () => countUserPosts(userId!),
    enabled: !!userId,
  });
}
