import type { LucideIcon } from "lucide-react-native";
import { Wallet, Drumstick, Leaf, Refrigerator, TrendingUp, Brain } from "lucide-react-native";
import type { ChipOption } from "@/frontend/components/ui";

// Four slide shapes so far — "content" (icon/eyebrow/hero/description),
// "preferences" (a title + a checkable options list), "preferenceGroups"
// (a title/subtitle + grouped chip-select sections), and "accountPitch"
// (the closing signup pitch). Each renders via its own component
// (ContentSlide / PreferencesSlide / PreferenceGroupsSlide /
// AccountPitchSlide); OnboardingScreen picks which one based on `type`.
// Add a new type here + a new component rather than branching inside an
// existing slide component as slide shapes grow.

export type HeroSegment = {
  text: string;
  color?: "primary" | "accent"; // omit for default ink.emphasis
  breakAfter?: boolean; // force a line break after this segment
};

export type ContentSlideData = {
  id: string;
  type: "content";
  caption: string;
  hero: HeroSegment[];
  description: string;
  image?: number;
};

export type PreferenceOption = {
  id: string;
  label: string;
  icon: LucideIcon;
  defaultSelected?: boolean;
};

export type PreferencesSlideData = {
  id: string;
  type: "preferences";
  title: string;
  image?: number;
  options: PreferenceOption[];
};

export type PreferenceGroup = {
  id: string;
  title: string;
  mode: "single" | "multi";
  options: ChipOption[];
};

export type PreferenceGroupsSlideData = {
  id: string;
  type: "preferenceGroups";
  title: string;
  subtitle: string;
  note: string;
  image?: number;
  groups: PreferenceGroup[];
};

export type AccountPitchSlideData = {
  id: string;
  type: "accountPitch";
  hero: HeroSegment[];
  subtitle: string;
  benefits: string[];
  image?: number;
};

export type OnboardingSlideData =
  | ContentSlideData
  | PreferencesSlideData
  | PreferenceGroupsSlideData
  | AccountPitchSlideData;

export const onboardingSlides: OnboardingSlideData[] = [
  {
    id: "1",
    type: "content",
    caption: "Find Filipino meals",
    hero: [
      { text: "Discover", color: "primary", breakAfter: true },
      { text: "what to ", breakAfter: true },
      { text: "cook" },
    ],
    description:
      "Get an idea on what to cook based on your budget, preferences and nutrition goals.",
    image: require("@/assets/onboarding/slide-1.gif"),
  },
  {
    id: "2",
    type: "content",
    caption: "Make every peso count",
    hero: [
      { text: "Shop", color: "primary", breakAfter: true },
      { text: "Smarter" },
    ],
    description:
      "Keep an eye on ingredient prices with Price Watch so you can spot what's affordable before you shop.",
    image: require("@/assets/onboarding/slide-2.gif"),
  },
  {
    id: "3",
    type: "content",
    caption: "From cravings to grocery",
    hero: [
      { text: "Plan ", color: "primary" },
      { text: "your", breakAfter: true },
      { text: "meals" },
    ],
    description: "Balance your macros and see what you need to buy, all in one place.",
    image: require("@/assets/onboarding/slide-3.gif"),
  },
  {
    id: "4",
    type: "preferences",
    title: "What matters to you?",
    image: require("@/assets/onboarding/preferences.gif"),
    options: [
      { id: "save-money", label: "Save money", icon: Wallet, defaultSelected: true },
      { id: "protein", label: "Eat more protein", icon: Drumstick, defaultSelected: true },
      { id: "healthier", label: "Eat healthier", icon: Leaf },
      { id: "use-what-i-have", label: "Use what I already have", icon: Refrigerator },
      { id: "track-macros", label: "Track macros", icon: TrendingUp },
      {
        id: "decision-fatigue",
        label: "Reduce decision fatigue",
        icon: Brain,
        defaultSelected: true,
      },
    ],
  },
  {
    id: "5",
    type: "preferenceGroups",
    title: "Preferences",
    subtitle: "Tell us a bit about how you eat. This is optional, and you can change it anytime.",
    image: require("@/assets/onboarding/preferences-icon.gif"),
    note: "Your preferences are saved automatically. Update them anytime in Profile settings.",
    groups: [
      {
        id: "dietary-focus",
        title: "Dietary Focus",
        mode: "single",
        options: [
          { id: "vegan", label: "Vegan" },
          { id: "vegetarian", label: "Vegetarian" },
          { id: "keto", label: "Keto" },
          { id: "pescatarian", label: "Pescatarian" },
          { id: "none", label: "None" },
          { id: "paleo", label: "Paleo" },
        ],
      },
      {
        id: "allergens",
        title: "Allergens",
        mode: "multi",
        options: [
          { id: "nuts", label: "Nuts" },
          { id: "gluten", label: "Gluten" },
          { id: "dairy", label: "Dairy" },
          { id: "shellfish", label: "Shellfish" },
          { id: "soy", label: "Soy" },
          { id: "coconut", label: "Coconut" },
          { id: "sesame", label: "Sesame" },
          { id: "none", label: "None" },
        ],
      },
    ],
  },
  {
    id: "6",
    type: "accountPitch",
    hero: [
      { text: "Make " },
      { text: "Ano", color: "primary" },
      { text: "Ulam", color: "accent" },
      { text: " yours" },
    ],
    subtitle: "Create a free account for the full AnoUlam experience.",
    benefits: [
      "Save your favorite meals",
      "Track your pantry and grocery list",
      "Set your preferences",
      "Keep your meal plan",
    ],
    image: require("@/assets/onboarding/slide-6.gif"),
  },
];
