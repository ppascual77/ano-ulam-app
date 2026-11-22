import { useEffect } from "react";
import { View } from "react-native";
import { Plus, Refrigerator } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { usePantryActions } from "@/frontend/core/pantry/hooks/usePantry";
import { PantrySection } from "@/frontend/core/pantry/components/PantrySection";
import { EmptyState } from "../EmptyState";

// What's in the user's kitchen: the same pantry section as Home's Pantry
// mode, with a section title and count instead of a page title, and
// Profile's own empty state (like Saved and Created) instead of Home's. Saved when
// the Add Ingredients sheet closes, and when the tab goes away (switching
// tabs or leaving Profile).
export function PantryTab() {
  const actions = usePantryActions();
  useEffect(() => {
    return () => void actions.persist();
    // Save once, on unmount.
  }, []);

  return (
    <View className="pb-6">
      <PantrySection
        title="section"
        renderEmpty={(openAdd) => (
          <EmptyState
            Icon={Refrigerator}
            iconColor={colors.primary}
            title="Your pantry's looking bare"
            body="Tell us what's in your kitchen and we'll tell you what to cook."
            action={{ label: "Add ingredients", Icon: Plus, onPress: openAdd }}
          />
        )}
      />
    </View>
  );
}
