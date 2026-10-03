import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Bookmark, Utensils } from "lucide-react-native";
import { ConfirmSheet } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MealCard } from "@/frontend/core/meals/components/card/MealCard";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { useSavedMealActions, useSavedMeals } from "@/frontend/core/saved/hooks/useSavedMeals";
import type { SavedMeal } from "@/frontend/core/saved/types";
import { MealGrid } from "../MealGrid";
import { MealGridSkeleton } from "../MealGridSkeleton";
import { EmptyState } from "../EmptyState";
import { CatalogStatusStrip, PosterChip } from "../CardOverlays";
import { openProfile } from "@/frontend/core/users/openProfile";
import { useMe } from "../../hooks/useProfile";
import { UpdatedMealPrompt } from "./UpdatedMealPrompt";
import { useLastDefined } from "../../hooks/useLastDefined";

type SavedTabProps = {
  onToast: (message: string, tone: "success" | "error") => void;
};

// Owner's saved meals in a 2-column grid. (The meal-plan banner,
// MealPlanBanner, is hidden for now.)
// Unsaving asks first ("Remove this meal?"); a meal the creator has since
// edited asks to sync before opening.
export function SavedTab({ onToast }: SavedTabProps) {
  const { data: saved = [], isLoading } = useSavedMeals();
  const actions = useSavedMealActions();
  const me = useMe();

  const [detail, setDetail] = useState<SavedMeal | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<SavedMeal | null>(null);
  const [updated, setUpdated] = useState<SavedMeal | null>(null);
  const [syncing, setSyncing] = useState(false);
  // Opened once the prompt has finished closing (sheets never overlap).
  const afterPrompt = useRef<SavedMeal | null>(null);
  const removeName = useLastDefined(confirmRemove?.name);

  const unsave = async (entry: SavedMeal) => {
    const error = await actions.unsave(entry);
    if (error) onToast(error, "error");
  };

  const openCard = (entry: SavedMeal) => {
    if (entry.catalog_status === "updated") setUpdated(entry);
    else setDetail(entry);
  };

  const sync = async () => {
    if (!updated) return;
    setSyncing(true);
    const error = await actions.sync(updated);
    setSyncing(false);
    // A failed sync leaves the prompt open to retry.
    if (!error) setUpdated(null);
  };

  return (
    <View>
      {isLoading ? (
        <MealGridSkeleton />
      ) : saved.length === 0 ? (
        <EmptyState
          Icon={Bookmark}
          iconColor={colors.brandOrange}
          title="Nothing saved yet"
          body="Discover Filipino meals you love and bookmark them for later."
          action={{ label: "Explore Meals", Icon: Utensils, onPress: () => router.navigate("/browse") }}
        />
      ) : (
        <MealGrid
          items={saved}
          keyOf={(entry) => entry.saved_id}
          renderItem={(entry, width) => (
            <MealCard
              meal={entry}
              width={width}
              layout="grid"
              isFastFood={entry.category === "fast_food"}
              onPress={() => openCard(entry)}
              onBookmarkPress={() => setConfirmRemove(entry)}
              topLeft={entry.poster_id ? <PosterChip onPress={() => openProfile(entry.poster_id, me.id)} /> : undefined}
              imageFooter={<CatalogStatusStrip status={entry.catalog_status} />}
            />
          )}
        />
      )}

      <MealDetailSheet meal={detail} onClose={() => setDetail(null)} onNotify={onToast} />

      <ConfirmSheet
        visible={!!confirmRemove}
        title="Remove this meal?"
        body={
          <Text className="mt-1 text-center font-inter-regular text-body text-web-ink-muted">
            <Text className="font-inter-medium text-web-ink-soft">{removeName}</Text> will be removed from your
            saved list.
          </Text>
        }
        confirmLabel="Remove"
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => {
          if (confirmRemove) void unsave(confirmRemove);
          setConfirmRemove(null);
        }}
      />

      <UpdatedMealPrompt
        name={updated?.name ?? null}
        syncing={syncing}
        onClose={() => setUpdated(null)}
        onClosed={() => {
          if (afterPrompt.current) setDetail(afterPrompt.current);
          afterPrompt.current = null;
        }}
        onSync={sync}
        onUnsave={() => {
          if (updated) void unsave(updated);
          setUpdated(null);
        }}
        onViewSaved={() => {
          afterPrompt.current = updated;
          setUpdated(null);
        }}
      />
    </View>
  );
}
