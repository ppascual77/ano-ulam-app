export const proKeys = {
  all: ["pro"] as const,
  rewards: (userId: string) => ["pro", "rewards", userId] as const,
};
