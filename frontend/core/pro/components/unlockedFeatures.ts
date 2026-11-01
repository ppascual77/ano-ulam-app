import { BellRing, Bookmark, CalendarDays, Ban, Leaf, PiggyBank, Search, Target, type LucideIcon } from "lucide-react-native";

// What Pro unlocks, as the unlock screen and the cancel flow list it: one
// line each on what it does for you, and where to try it (`route`, opened
// after the unlock screen closes; none when it's simply there).

export type UnlockedFeature = {
  key: string;
  Icon: LucideIcon;
  title: string;
  detail: string;
  /** Where "try it" goes, if anywhere. */
  route?: string;
  cta?: string;
};

export const UNLOCKED_FEATURES: UnlockedFeature[] = [
  {
    key: "planner",
    Icon: CalendarDays,
    title: "Your whole week, planned",
    detail: "5-day meal plans, swaps, and a grocery list for the week.",
    route: "/meal-planner",
    cta: "Plan my week",
  },
  {
    key: "alerts",
    Icon: BellRing,
    title: "Price drop alerts",
    detail: "Watch ingredients and see when they get cheaper.",
    route: "/profile/settings?pro=alerts",
    cta: "Pick ingredients",
  },
  {
    key: "savings",
    Icon: PiggyBank,
    title: "Weekly savings, in pesos",
    detail: "What price drops save you on your meals each week.",
    route: "/price-watch",
    cta: "See my savings",
  },
  {
    key: "avoid",
    Icon: Ban,
    title: "Ingredients to avoid",
    detail: "Meals with them never show up anywhere.",
    route: "/profile/settings?pro=avoid",
    cta: "Choose ingredients",
  },
  {
    key: "goals",
    Icon: Target,
    title: "Nutrition goals",
    detail: "See every meal against your daily targets.",
    route: "/profile/settings?pro=goals",
    cta: "Set my goals",
  },
  {
    key: "unlimited",
    Icon: Search,
    title: "No daily limits",
    detail: "Search and get suggestions as often as you like.",
  },
  {
    key: "saved",
    Icon: Bookmark,
    title: "Unlimited saved meals",
    detail: "Keep every meal you want to cook.",
  },
  {
    key: "micros",
    Icon: Leaf,
    title: "Fiber, sugar and sodium",
    detail: "For every meal and ingredient, in Meal Details.",
  },
];
