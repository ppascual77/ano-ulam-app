// Recommended daily calorie and macro targets from a user's stats.

export type Sex = "male" | "female";
export type Goal = "lose" | "build" | "maintain";
export type Activity = "sedentary" | "light" | "moderate" | "very" | "athlete";

export type BodyStats = {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  /** Optional. When given, BMR uses lean mass (Katch-McArdle). */
  bodyFatPct: number | null;
};

export type MacroTargets = { calories: number; protein: number; carbs: number; fats: number };

export const GOAL_OPTIONS: { value: Goal; label: string; description: string }[] = [
  { value: "lose", label: "Lose fat", description: "Lower calories while keeping you full" },
  { value: "build", label: "Build muscle", description: "Higher protein to support muscle growth" },
  { value: "maintain", label: "Maintain", description: "Keep your current weight" },
];

export const ACTIVITY_OPTIONS: { value: Activity; label: string; description: string }[] = [
  { value: "sedentary", label: "Sedentary", description: "Little or no exercise" },
  { value: "light", label: "Lightly active", description: "1–2x/week exercise" },
  { value: "moderate", label: "Moderately active", description: "3–5x/week gym" },
  { value: "very", label: "Very active", description: "6–7x/week hard training" },
  { value: "athlete", label: "Athlete", description: "Twice a day, or a physical job" },
];

const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  athlete: 1.9,
};

// Calorie adjustment per goal, on top of maintenance.
const GOAL_FACTOR: Record<Goal, number> = { lose: 0.8, build: 1.1, maintain: 1 };
// Protein per kg of body weight.
const PROTEIN_PER_KG: Record<Goal, number> = { lose: 2.0, build: 2.0, maintain: 1.6 };
// Share of calories from fat; carbs take the rest.
const FAT_SHARE = 0.27;

export function recommendTargets(stats: BodyStats, goal: Goal, activity: Activity): MacroTargets {
  const bmr =
    stats.bodyFatPct != null
      ? 370 + 21.6 * stats.weightKg * (1 - stats.bodyFatPct / 100)
      : 10 * stats.weightKg + 6.25 * stats.heightCm - 5 * stats.age + (stats.sex === "male" ? 5 : -161);
  // Rounded to the nearest 50, like a target someone would actually aim for.
  const calories = Math.round((bmr * ACTIVITY_FACTOR[activity] * GOAL_FACTOR[goal]) / 50) * 50;
  const protein = Math.round(stats.weightKg * PROTEIN_PER_KG[goal]);
  const fats = Math.round((calories * FAT_SHARE) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fats * 9) / 4));
  return { calories, protein, carbs, fats };
}
