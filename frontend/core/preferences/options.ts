// Dietary focus / allergen choices, stored in users.preferences. Shared by
// Home's PreferencesSheet and Profile Settings. Kept in sync by hand with
// frontend/features/onboarding/slides.ts's "preferenceGroups" slide: same
// underlying preference, three entry points.
export const DIETARY_FOCUS_OPTIONS = [
  { id: "vegan", label: "Vegan" },
  { id: "vegetarian", label: "Vegetarian" },
  { id: "keto", label: "Keto" },
  { id: "pescatarian", label: "Pescatarian" },
  { id: "none", label: "None" },
  { id: "paleo", label: "Paleo" },
];

export const ALLERGEN_OPTIONS = [
  { id: "nuts", label: "Nuts" },
  { id: "gluten", label: "Gluten" },
  { id: "dairy", label: "Dairy" },
  { id: "shellfish", label: "Shellfish" },
  { id: "soy", label: "Soy" },
  { id: "coconut", label: "Coconut" },
  { id: "sesame", label: "Sesame" },
  { id: "none", label: "None" },
];
