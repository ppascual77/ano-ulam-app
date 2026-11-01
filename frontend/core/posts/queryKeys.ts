// Post lists depend on who's looking (each post's `liked`), so the viewer's
// id is part of every key.
export const postKeys = {
  all: (viewerId: string | null) => ["posts", viewerId] as const,
  feed: (viewerId: string | null) => ["posts", viewerId, "feed"] as const,
  user: (viewerId: string | null, userId: string) => ["posts", viewerId, "user", userId] as const,
};
