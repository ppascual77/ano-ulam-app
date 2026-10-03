import { useState } from "react";
import { View } from "react-native";
import { Bookmark, Lock } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { MealCard } from "@/frontend/core/meals/components/card/MealCard";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import type { SavedMeal } from "@/frontend/core/saved/types";
import type { PublicProfile } from "../../mock/users";
import { MealGrid } from "../MealGrid";
import { EmptyState } from "../EmptyState";
import { PosterChip } from "../CardOverlays";
import { openProfile } from "@/frontend/core/users/openProfile";
import { useMe } from "../../hooks/useProfile";

type VisitorSavedTabProps = {
  profile: PublicProfile;
  onToast: (message: string, tone: "success" | "error") => void;
};

// Someone else's saved meals: private, empty, or their grid (like only, no
// unsave). Meal Details saves into the viewer's own list.
export function VisitorSavedTab({ profile, onToast }: VisitorSavedTabProps) {
  const [detail, setDetail] = useState<SavedMeal | null>(null);
  const me = useMe();

  if (!profile.show_saved_public) {
    return (
      <EmptyState
        Icon={Lock}
        iconColor={colors.webInk.muted}
        badge={false}
        title="Saved meals are private"
        body="This user hasn't made their saved meals public."
      />
    );
  }
  if (profile.saved_meals.length === 0) {
    return (
      <EmptyState
        Icon={Bookmark}
        iconColor={colors.webInk.muted}
        badge={false}
        title="No saved meals yet"
        body="This user hasn't saved any meals yet."
      />
    );
  }

  return (
    <View className="pb-6">
      <MealGrid
        items={profile.saved_meals}
        keyOf={(entry) => entry.saved_id}
        renderItem={(entry, width) => (
          <MealCard
            meal={entry}
            width={width}
            layout="grid"
            isFastFood={entry.category === "fast_food"}
            hideBookmark
            onPress={() => setDetail(entry)}
            topLeft={entry.poster_id ? <PosterChip onPress={() => openProfile(entry.poster_id, me.id)} /> : undefined}
          />
        )}
      />
      <MealDetailSheet meal={detail} onClose={() => setDetail(null)} onNotify={onToast} />
    </View>
  );
}
