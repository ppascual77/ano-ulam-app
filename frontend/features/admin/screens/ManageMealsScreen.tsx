import { useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { router } from "expo-router";
import { Plus, Trash2 } from "lucide-react-native";
import { AppText, Button, ConfirmSheet, ErrorState, Screen, SearchBar } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MealCard } from "@/frontend/core/meals/components/card/MealCard";
import { MealCardSkeleton } from "@/frontend/core/meals/components/card/MealCardSkeleton";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { useArchiveMeal, useDeleteMeal, useMeal, useMeals } from "../hooks/useMeals";
import { mealRowToMealType } from "@/frontend/core/meals/utils/mealAdapter";
import { AdminHeader } from "../components/AdminHeader";

const SCREEN_PADDING = 20 * 2; // matches Screen's px-5
const COLUMN_GAP = 12;
const GRID_SKELETON_COUNT = 6;

export default function ManageMealsScreen() {
  const { data: meals, isLoading, isError } = useMeals({});
  const [search, setSearch] = useState("");
  const { width: screenWidth } = useWindowDimensions();

  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const { data: selectedMeal } = useMeal(selectedMealId);
  const archiveMeal = useArchiveMeal();
  const deleteMeal = useDeleteMeal();

  // Delete confirmation is a second sheet, opened only once the detail
  // sheet has actually finished closing (BottomSheet's onClosed) — two RN
  // Modals presented at once, even briefly, can leave an orphaned overlay
  // that blocks all touches (see the AI-Estimate/Review fix from earlier).
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [pendingDeleteConfirm, setPendingDeleteConfirm] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  // Same reasoning as the delete-confirm sequencing above — navigating to
  // Edit Meal while this sheet's Modal is still up leaves it floating over
  // the new screen (a Modal isn't part of the navigation stack, so pushing
  // a route doesn't close it on its own). Close first, navigate only once
  // BottomSheet's onClosed confirms the close animation actually finished.
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return meals ?? [];
    return (meals ?? []).filter((m) => m.name.toLowerCase().includes(q));
  }, [meals, search]);

  const cardWidth = (screenWidth - SCREEN_PADDING - COLUMN_GAP) / 2;

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMeal.mutate(deleteTarget.id, {
      onSuccess: () => {
        setConfirmDeleteVisible(false);
        setDeleteTarget(null);
      },
    });
  };

  return (
    <Screen padded={false}>
      <AdminHeader title="Manage Meals" subtitle={`${meals?.length ?? 0} meals`} />

      <View className="px-5 gap-3 mb-4">
        <Button
          label="Seed meal"
          icon={<Plus color={colors.white} size={20} strokeWidth={2.5} />}
          onPress={() => router.push("/seed-meal")}
        />
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search meals..." />
      </View>

      {isLoading ? (
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View className="flex-row flex-wrap justify-between gap-y-4">
            {Array.from({ length: GRID_SKELETON_COUNT }).map((_, i) => (
              <MealCardSkeleton key={i} width={cardWidth} />
            ))}
          </View>
        </ScrollView>
      ) : isError ? (
        <ErrorState />
      ) : (
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View className="flex-row flex-wrap justify-between gap-y-4">
            {filtered.map((meal) => (
              <MealCard
                key={meal.id}
                meal={mealRowToMealType(meal)}
                width={cardWidth}
                layout="grid"
                onPress={() => setSelectedMealId(meal.id)}
              />
            ))}
          </View>
          {filtered.length === 0 && (
            <AppText variant="body" className="text-ink-subtle text-center mt-8">
              {search ? "No meals match your search." : "No meals yet — seed one to get started."}
            </AppText>
          )}
        </ScrollView>
      )}

      <MealDetailSheet
        meal={selectedMeal ? mealRowToMealType(selectedMeal, selectedMeal.meal_ingredients) : null}
        onClose={() => setSelectedMealId(null)}
        onClosed={() => {
          if (pendingDeleteConfirm) {
            setConfirmDeleteVisible(true);
            setPendingDeleteConfirm(false);
          }
          if (pendingEditId) {
            router.push(`/edit-meal/${pendingEditId}`);
            setPendingEditId(null);
          }
        }}
        onEdit={() => {
          if (!selectedMealId) return;
          setPendingEditId(selectedMealId);
          setSelectedMealId(null);
        }}
        onArchive={() => {
          if (!selectedMealId) return;
          archiveMeal.mutate(selectedMealId, { onSuccess: () => setSelectedMealId(null) });
        }}
        onDelete={() => {
          if (!selectedMeal) return;
          setDeleteTarget({ id: selectedMeal.id, name: selectedMeal.name });
          setPendingDeleteConfirm(true);
          setSelectedMealId(null);
        }}
      />

      <ConfirmSheet
        visible={confirmDeleteVisible}
        icon={
          <View className="h-12 w-12 items-center justify-center rounded-full bg-like-soft">
            <Trash2 color={colors.like} size={20} />
          </View>
        }
        title="Delete this meal?"
        body={deleteTarget ? `"${deleteTarget.name}" will be removed from the catalog. This cannot be undone.` : undefined}
        confirmLabel={deleteMeal.isPending ? "Deleting…" : "Delete meal"}
        busy={deleteMeal.isPending}
        onCancel={() => setConfirmDeleteVisible(false)}
        onConfirm={handleDelete}
      />
    </Screen>
  );
}
