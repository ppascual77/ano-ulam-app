import { BellRing, Bookmark, CalendarDays, Ban, Leaf, PiggyBank, Search, Target, type LucideIcon } from "lucide-react-native";

// What Pro includes, as the unlock screen lists it: one line each on what
// it does for you.

export type UnlockedFeature = {
  key: string;
  Icon: LucideIcon;
  title: string;
  detail: string;
};

export const UNLOCKED_FEATURES: UnlockedFeature[] = [
  {
    key: "planner",
    Icon: CalendarDays,
    title: "Your whole week, planned",
    detail: "5- or 7-day meal plans, swaps, and a grocery list for them.",
  },
  {
    key: "alerts",
    Icon: BellRing,
    title: "Price drop alerts",
    detail: "A push the day an ingredient drops 5% or more at NCR markets.",
  },
  {
    key: "savings",
    Icon: PiggyBank,
    title: "Weekly savings, in pesos",
    detail: "Saturday's best buys: the week's 3 biggest drops, in pesos.",
  },
  {
    key: "avoid",
    Icon: Ban,
    title: "Ingredients to avoid",
    detail: "Meals with them never show up anywhere.",
  },
  {
    key: "goals",
    Icon: Target,
    title: "Nutrition goals",
    detail: "Plans aim at your targets, and meals show how they fit.",
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
