import { router } from "expo-router";
import { ClipboardCheck, Carrot, Landmark, Sprout, User, Users, Utensils } from "lucide-react-native";
import type { DropdownItem } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

// TODO: replace with a real check (e.g. profile.tier === "admin") once the
// backend session is reliably testable — hardcoded true for now so the admin
// menu can be built/tested ahead of that.
export const isAdmin = true;

// The admin menu, opened from the Profile tab's avatar in the bottom nav
// (it used to hang off Home's header avatar).
export function adminMenuItems(): DropdownItem[] {
  const icon = (Icon: typeof Users) => <Icon color={colors.ink.subtle} size={18} />;
  return [
    // TODO: no admin screens built yet — wire up once needed.
    { label: "Manage Users", icon: icon(Users), onPress: () => console.log("TODO: Manage Users") },
    { label: "Manage Meals", icon: icon(Utensils), onPress: () => router.push("/manage-meals") },
    { label: "Manage Ingredients", icon: icon(Carrot), onPress: () => router.push("/manage-ingredients") },
    { label: "DA Daily Prices", icon: icon(Landmark), onPress: () => router.push("/da-prices") },
    { label: "Seed Meal", icon: icon(Sprout), onPress: () => router.push("/seed-meal") },
    { label: "Review Recipes", icon: icon(ClipboardCheck), onPress: () => router.push("/review-recipes") },
    { label: "Visit Profile", icon: icon(User), onPress: () => router.navigate("/profile") },
  ];
}
