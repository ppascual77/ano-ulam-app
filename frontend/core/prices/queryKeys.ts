export const priceKeys = {
  items: ["prices", "items"] as const,
  bestValueMeals: (ingredientIds: string[]) => ["prices", "best-value-meals", ingredientIds] as const,
  mealsFor: (ingredientId: string | null) => ["prices", "meals-for", ingredientId] as const,
};
