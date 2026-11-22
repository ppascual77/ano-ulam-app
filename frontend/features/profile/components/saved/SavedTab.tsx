import { useCallback, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { router, useFocusEffect } from "expo-router";
import { Bookmark, ChevronRight, Lock, Utensils } from "lucide-react-native";
import { ConfirmSheet } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MealCard } from "@/frontend/core/meals/components/card/MealCard";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { useLockedSaves, useSavedMealActions, useSavedMeals } from "@/frontend/core/saved/hooks/useSavedMeals";
import { markSavedSeen, useSaveFeedbackStore } from "@/frontend/core/saved/store/useSaveFeedbackStore";
import { SAVED_MEALS_LIMIT, type SavedMeal } from "@/frontend/core/saved/types";
import { MealGrid } from "../MealGrid";
import { MealGridSkeleton } from "../MealGridSkeleton";
import { EmptyState } from "../EmptyState";
import { CatalogStatusStrip, hasCatalogStrip, PosterChip } from "../CardOverlays";
import { openProfile } from "@/frontend/core/users/openProfile";
import { useMe } from "../../hooks/useProfile";
import { UpdatedMealPrompt } from "./UpdatedMealPrompt";
import { NutritionSummaryCard } from "./NutritionSummaryCard";
import { NutritionSummarySheet } from "./NutritionSummarySheet";
import { FreshPulse } from "./FreshPulse";
import { useLastDefined } from "../../hooks/useLastDefined";

type SavedTabProps = {
  onToast: (message: string, tone: "success" | "error") => void;
};

// Owner's saved meals in a 2-column grid, under a nutrition summary card
// that opens the full breakdown. (The meal-plan banner, MealPlanBanner, is
// hidden for now.)
// Unsaving asks first ("Remove this meal?"); a meal the creator has since
// edited asks to sync before opening. Seeing this tab clears the Profile
// tab's "new saved meal" dot, and the meal just saved pulses once.
export function SavedTab({ onToast }: SavedTabProps) {
  const { data: saved = [], isLoading } = useSavedMeals();
  const actions = useSavedMealActions();
  const me = useMe();
  // After Pro ends: saves past the newest 10 are locked (not on the grocery
  // list); they stay here, dimmed with a lock strip, to unsave or keep.
  const locked = useLockedSaves();

  const [detail, setDetail] = useState<SavedMeal | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<SavedMeal | null>(null);
  const [updated, setUpdated] = useState<SavedMeal | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [nutritionOpen, setNutritionOpen] = useState(false);

  // Re-runs when a save lands while this tab is already on screen.
  const unseen = useSaveFeedbackStore((s) => s.unseen);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      const key = markSavedSeen();
      if (key) setFreshKey(key);
    }, [unseen]),
  );
  // Opened once the prompt has finished closing (sheets never overlap).
  const afterPrompt = useRef<SavedMeal | null>(null);
  const removeName = useLastDefined(confirmRemove?.name);

  // Its "Removed" (with Undo) or error toast comes from the actions.
  const unsave = (entry: SavedMeal) => void actions.unsave(entry);

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
          iconColor={colors.accent}
          title="No favorites yet"
          body="Tap the bookmark on any meal you'd cook again."
          action={{ label: "Explore Meals", Icon: Utensils, onPress: () => router.navigate("/browse") }}
        />
      ) : (
        <>
          {locked.size > 0 && <LockedSavesNote count={locked.size} />}
          <NutritionSummaryCard saved={saved} onPress={() => setNutritionOpen(true)} />
          <MealGrid
            items={saved}
            keyOf={(entry) => entry.saved_id}
            renderItem={(entry, width) => (
              <FreshPulse active={entry.meal_catalog_id === freshKey} onDone={() => setFreshKey(null)}>
                <View style={locked.has(entry.saved_id) ? { opacity: 0.6 } : undefined}>
                  <MealCard
                    meal={entry}
                    width={width}
                    layout="grid"
                    isFastFood={entry.category === "fast_food"}
                    onPress={() => openCard(entry)}
                    onBookmarkPress={() => setConfirmRemove(entry)}
                    topLeft={entry.poster_id ? <PosterChip onPress={() => openProfile(entry.poster_id, me.id)} /> : undefined}
                    imageFooter={
                      locked.has(entry.saved_id) ? (
                        <LockedStrip />
                      ) : hasCatalogStrip(entry.catalog_status) ? (
                        <CatalogStatusStrip status={entry.catalog_status} />
                      ) : undefined
                    }
                  />
                </View>
              </FreshPulse>
            )}
          />
        </>
      )}

      <NutritionSummarySheet visible={nutritionOpen} onClose={() => setNutritionOpen(false)} saved={saved} />
      <MealDetailSheet meal={detail} onClose={() => setDetail(null)} onNotify={onToast} />

      <ConfirmSheet
        visible={!!confirmRemove}
        title="Remove this meal?"
        body={
          <Text className="mt-1 text-center font-inter-regular text-body text-ink-subtle">
            <Text className="font-inter-medium text-ink">{removeName}</Text> will be removed from your
            saved list.
          </Text>
        }
        confirmLabel="Remove"
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => {
          if (confirmRemove) unsave(confirmRemove);
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
          if (updated) unsave(updated);
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

// Over a locked save's photo, where the catalog strips go.
function LockedStrip() {
  return (
    <View className="flex-row items-center justify-center gap-1.5 bg-ink-emphasis/70 px-2 py-1">
      <Lock color={colors.white} size={11} strokeWidth={2.5} />
      <Text className="font-inter-semibold text-sub text-white">Locked · not on your list</Text>
    </View>
  );
}

// Above the grid while some saves are locked: what happened and the two
// ways out (unsave to choose, or Pro).
function LockedSavesNote({ count }: { count: number }) {
  return (
    <View className="mb-3 gap-2 rounded-2xl bg-ink-emphasis/5 px-4 py-3">
      <View className="flex-row items-start gap-2.5">
        <View className="pt-0.5">
          <Lock color={colors.ink.emphasis} size={15} />
        </View>
        <Text className="flex-1 font-inter-regular text-small text-ink-subtle">
          <Text className="font-inter-semibold text-ink-emphasis">
            {count} older {count === 1 ? "save is" : "saves are"} locked.
          </Text>{" "}
          Free keeps your {SAVED_MEALS_LIMIT} newest ready to cook and on your grocery list. Unsave some to choose which.
        </Text>
      </View>
      <Pressable
        onPress={() => router.push({ pathname: "/pro", params: { source: "saved_limit" } })}
        hitSlop={8}
        accessibilityRole="link"
        className="ml-6 flex-row items-center gap-1 self-start active:opacity-70"
      >
        <Text className="font-inter-semibold text-small text-primary">Unlock them all with Pro</Text>
        <ChevronRight color={colors.primary} size={15} />
      </Pressable>
    </View>
  );
}
