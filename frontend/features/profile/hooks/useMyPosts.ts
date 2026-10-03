import { useCallback, useEffect, useRef, useState } from "react";
import { deletePost, listUserPosts, togglePostLike, type FoodPost } from "@/frontend/core/posts/mock/posts";

const PAGE_SIZE = 10;

// One user's food posts (Profile > Created), 10 per page. `refreshKey`:
// bump to reload from the top (after creating or editing a post).
export function useMyPosts(userId: string, refreshKey = 0) {
  const [posts, setPosts] = useState<FoodPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offset = useRef(0);
  const fetching = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetching.current = true;
    setLoading(true);
    listUserPosts(userId, 0, PAGE_SIZE).then((page) => {
      if (cancelled) return;
      setPosts(page);
      offset.current = page.length;
      setHasMore(page.length === PAGE_SIZE);
      setLoading(false);
      fetching.current = false;
    });
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  const loadMore = useCallback(async () => {
    if (fetching.current || !hasMore) return;
    fetching.current = true;
    setLoadingMore(true);
    const page = await listUserPosts(userId, offset.current, PAGE_SIZE);
    setPosts((prev) => [...prev, ...page]);
    offset.current += page.length;
    setHasMore(page.length === PAGE_SIZE);
    setLoadingMore(false);
    fetching.current = false;
  }, [userId, hasMore]);

  // Optimistic, reverts on error.
  const toggleLike = async (post: FoodPost) => {
    const before = post.liked_by;
    const setLikedBy = (likedBy: string[]) =>
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, liked_by: likedBy } : p)));
    setLikedBy(before.includes(userId) ? before.filter((id) => id !== userId) : [...before, userId]);
    try {
      setLikedBy(await togglePostLike(post.id, userId));
    } catch {
      setLikedBy(before);
    }
  };

  // Removed right away, no confirm (same as the web's profile list).
  const remove = async (post: FoodPost) => {
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    offset.current = Math.max(0, offset.current - 1);
    await deletePost(post.id);
  };

  return { posts, loading, loadingMore, hasMore, loadMore, toggleLike, remove };
}
