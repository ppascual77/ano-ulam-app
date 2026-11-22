export const proKeys = {
  all: ["pro"] as const,
  rewards: (userId: string) => ["pro", "rewards", userId] as const,
  claims: (userId: string) => ["pro", "claims", userId] as const,
};
