export const authKeys = {
  userProfile: (userId: string) => ["userProfile", userId] as const,
};
