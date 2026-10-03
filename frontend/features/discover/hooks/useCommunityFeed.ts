import { useCallback, useEffect, useRef, useState } from "react";
import { deletePost, getCommunityPosts, togglePostLike, type FoodPost } from "../mock/posts";

const PAGE_SIZE = 5;

// Community tab state: posts paged in by 5 (load more near the end),
// optimistic like and delete. Only runs while `enabled` (signed in and on
// the Community tab) — guests see the join prompt instead of the feed.
export function useCommunityFeed({ enabled, userId }: { enabled: boolean; userId: string | null }) {
  const [posts, setPosts] = useState<FoodPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offset = useRef(0);
  const fetching = useRef(false);

  const refresh = useCallback(async () => {
    fetching.current = true;
    setLoading(true);
    const page = await getCommunityPosts(0, PAGE_SIZE);
    setPosts(page);
    offset.current = page.length;
    setHasMore(page.length === PAGE_SIZE);
    setLoading(false);
    fetching.current = false;
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  const loadMore = useCallback(async () => {
    if (fetching.current || !hasMore || loading) return;
    fetching.current = true;
    setLoadingMore(true);
    const page = await getCommunityPosts(offset.current, PAGE_SIZE);
    setPosts((prev) => [...prev, ...page]);
    offset.current += page.length;
    setHasMore(page.length === PAGE_SIZE);
    setLoadingMore(false);
    fetching.current = false;
  }, [hasMore, loading]);

  // Optimistic: update liked_by now, take the server's list, revert on error.
  const toggleLike = async (post: FoodPost) => {
    if (!userId) return;
    const before = post.liked_by;
    const optimistic = before.includes(userId) ? before.filter((id) => id !== userId) : [...before, userId];
    const setLikedBy = (likedBy: string[]) =>
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, liked_by: likedBy } : p)));
    setLikedBy(optimistic);
    try {
      setLikedBy(await togglePostLike(post.id, userId));
    } catch {
      setLikedBy(before);
    }
  };

  // Removed from the list right away (after the confirm sheet), like the web.
  const remove = async (post: FoodPost) => {
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    offset.current = Math.max(0, offset.current - 1);
    await deletePost(post.id);
  };

  return { posts, loading, loadingMore, hasMore, refresh, loadMore, toggleLike, remove };
}
