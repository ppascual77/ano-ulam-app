import { useState } from "react";
import { Alert, Pressable, View, useWindowDimensions } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { AppText, BottomSheet, Button, ErrorState, Screen, TextField } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { errorMessage } from "@/lib/errorMessage";
import { MealCard } from "@/frontend/core/meals/components/card/MealCard";
import { MealCardSkeleton } from "@/frontend/core/meals/components/card/MealCardSkeleton";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { mealRowToMealType } from "@/frontend/core/meals/utils/mealAdapter";
import { useApproveRecipe, usePendingRecipes, useRecipeForReview, useRejectRecipe } from "../hooks/useRecipeReview";

// Same grid as Manage Meals.
const SCREEN_PADDING = 40;
const COLUMN_GAP = 12;
const GRID_SKELETON_COUNT = 4;

// Admin queue of user-submitted recipes waiting for review (status
// 'pending'), oldest first, as the same meal cards and meal details sheet
// everyone sees, so a submission is reviewed exactly as it'll appear. The
// sheet's footer has Reject / Approve; approved recipes join the catalog.
export default function ReviewRecipesScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - SCREEN_PADDING - COLUMN_GAP) / 2;

  const { data: recipes, isLoading, isError, refetch } = usePendingRecipes();
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: openRecipe } = useRecipeForReview(openId);
  const approve = useApproveRecipe();
  const reject = useRejectRecipe();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const close = () => {
    setOpenId(null);
    setRejecting(false);
    setReason("");
  };

  const handleApprove = () => {
    if (!openId) return;
    approve.mutate(openId, {
      onSuccess: close,
      // e.g. a recipe from before free-text ingredients were removed that
      // still has some unlinked.
      onError: (err) => Alert.alert("Couldn't approve", errorMessage(err)),
    });
  };

  const handleReject = () => {
    if (!openId || !reason.trim()) return;
    reject.mutate(
      { mealId: openId, reason },
      { onSuccess: close, onError: (err) => Alert.alert("Couldn't reject", errorMessage(err)) },
    );
  };

  return (
    <Screen padded={false}>
      <View className="flex-row items-center gap-2 px-5 pb-4 pt-2">
        <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center">
          <ArrowLeft color={colors.ink.emphasis} size={18} />
        </Pressable>
        <View>
          <AppText variant="eyebrow">Admin</AppText>
          <AppText variant="heading">Review Recipes</AppText>
          <AppText variant="caption">{recipes?.length ?? 0} waiting for review</AppText>
        </View>
      </View>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View className="flex-row flex-wrap justify-between gap-y-4">
            {isLoading
              ? Array.from({ length: GRID_SKELETON_COUNT }).map((_, i) => <MealCardSkeleton key={i} width={cardWidth} />)
              : recipes?.map((meal) => (
                  <MealCard
                    key={meal.id}
                    meal={mealRowToMealType(meal)}
                    width={cardWidth}
                    layout="grid"
                    onPress={() => setOpenId(meal.id)}
                  />
                ))}
          </View>
          {!isLoading && recipes?.length === 0 && (
            <AppText variant="body" className="mt-8 text-center">
              No recipes waiting for review.
            </AppText>
          )}
        </ScrollView>
      )}

      <MealDetailSheet
        meal={openRecipe ? mealRowToMealType(openRecipe, openRecipe.meal_ingredients) : null}
        onClose={close}
        review={{ onApprove: handleApprove, onReject: () => setRejecting(true), busy: approve.isPending }}
        // Reject asks for a reason in a sheet on top, inline in this sheet's
        // overlay (two native Modals don't stack reliably).
        overlay={
          <BottomSheet
            visible={rejecting}
            onClose={() => setRejecting(false)}
            heightPercent={0.6}
            presentation="inline"
            fitContent
          >
            <View className="gap-4 px-5 pb-6 pt-12">
              <AppText variant="title">Reject this recipe?</AppText>
              <TextField
                label="Reason"
                labelPosition="outside"
                value={reason}
                onChangeText={setReason}
                placeholder="Shown to the person who submitted it"
                multiline
              />
              <Button
                label={reject.isPending ? "Rejecting..." : "Reject recipe"}
                variant="outline"
                disabled={!reason.trim() || reject.isPending}
                onPress={handleReject}
              />
            </View>
          </BottomSheet>
        }
      />
    </Screen>
  );
}
