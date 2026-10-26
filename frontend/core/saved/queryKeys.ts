// Per user, so signing out (or in as someone else) never shows the last
// user's saves; a guest's list is just empty.
export const savedKeys = {
  list: (userId: string | null) => ["saved", "list", userId ?? "guest"] as const,
};
