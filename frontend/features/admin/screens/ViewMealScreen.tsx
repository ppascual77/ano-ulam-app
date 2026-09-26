import { useState } from "react";
import { View, Pressable } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ImageOff, Pencil, Archive, Trash2 } from "lucide-react-native";
import { AppText, BottomSheet, Button, ErrorState, LoadingState, Screen } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { computeProposedTotals, convertQuantityToBasis, countsTowardMealTotals, type ProposedTotals } from "@/api/meals";
import { useArchiveMeal, useDeleteMeal, useMeal } from "../hooks/useMeals";

function contributionLabel(totals: ProposedTotals): string {
  const parts: string[] = [];
  if (totals.price != null) parts.push(`₱${totals.price.toFixed(2)}`);
  if (totals.calories != null) parts.push(`${totals.calories.toFixed(0)} cal`);
  return parts.length > 0 ? parts.join(" · ") : "no price/macro data";
}

function bridgeLabel(ingredient: { grams_per_piece: number | null; grams_per_ml: number | null; piece_label: string | null }): string | null {
  const parts: string[] = [];
  if (ingredient.grams_per_piece != null) parts.push(`${ingredient.grams_per_piece}g per ${ingredient.piece_label ?? "piece"}`);
  if (ingredient.grams_per_ml != null) parts.push(`${ingredient.grams_per_ml}g/ml`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

const IMAGE_HEIGHT = 220;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center gap-1 rounded-xl border border-ink-emphasis/10 bg-ink-emphasis/5 py-3">
      <AppText variant="bodyBold">{value}</AppText>
      <AppText variant="caption" className="text-ink-subtle">
        {label}
      </AppText>
    </View>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View className="rounded-full border border-ink-emphasis/10 bg-ink-emphasis/5 px-3 py-1">
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3 mb-6">
      <AppText variant="bodyBold">{title}</AppText>
      {children}
    </View>
  );
}

export default function ViewMealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: meal, isLoading, isError } = useMeal(id ?? null);
  const archiveMeal = useArchiveMeal();
  const deleteMeal = useDeleteMeal();
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

  const handleArchive = () => {
    if (!meal) return;
    archiveMeal.mutate(meal.id, { onSuccess: () => router.back() });
  };

  const handleDelete = () => {
    if (!meal) return;
    deleteMeal.mutate(meal.id, {
      onSuccess: () => {
        setConfirmDeleteVisible(false);
        router.back();
      },
    });
  };

  return (
    <Screen padded={false}>
      <View className="px-5 pt-2 pb-4 flex-row items-center gap-2">
        <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center">
          <ArrowLeft color={colors.ink.emphasis} size={18} />
        </Pressable>
        <View className="flex-1">
          <AppText variant="eyebrow">Admin</AppText>
          <AppText variant="heading" numberOfLines={1}>
            {meal?.name ?? "View Meal"}
          </AppText>
        </View>
        {meal && (
          <Pressable onPress={() => router.push(`/edit-meal/${meal.id}`)} className="h-9 w-9 items-center justify-center">
            <Pencil color={colors.primary} size={18} />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <LoadingState />
      ) : isError || !meal ? (
        <ErrorState />
      ) : (
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View className="rounded-2xl overflow-hidden mb-4">
            {meal.image_url ? (
              <Image source={{ uri: meal.image_url }} style={{ width: "100%", height: IMAGE_HEIGHT }} contentFit="cover" />
            ) : (
              <View style={{ height: IMAGE_HEIGHT }} className="items-center justify-center bg-ink-emphasis/5">
                <ImageOff color={colors.ink.subtle} size={28} />
              </View>
            )}
          </View>

          <View className="flex-row flex-wrap gap-2 mb-4">
            {meal.category && <Chip label={meal.category} />}
            {meal.difficulty && <Chip label={meal.difficulty} />}
            {meal.protein_type && <Chip label={meal.protein_type} />}
            {!meal.ingredients_synced_at && <Chip label="Not synced" />}
          </View>

          {meal.description && (
            <AppText variant="body" className="text-ink-subtle mb-4">
              {meal.description}
            </AppText>
          )}

          <View className="flex-row gap-2 mb-6">
            <Stat label="Price" value={meal.price != null ? `₱${meal.price.toFixed(0)}` : "—"} />
            <Stat label="Calories" value={meal.calories != null ? `${Math.round(meal.calories)}` : "—"} />
            <Stat label="Total time" value={meal.total_time ? `${meal.total_time}m` : "—"} />
            <Stat label="Servings" value={`${meal.serving_size}`} />
          </View>

          <Section title="Macros (per serving)">
            <View className="flex-row gap-2">
              <Stat label="Protein" value={meal.protein != null ? `${meal.protein.toFixed(1)}g` : "—"} />
              <Stat label="Carbs" value={meal.carbohydrates != null ? `${meal.carbohydrates.toFixed(1)}g` : "—"} />
              <Stat label="Fat" value={meal.fat != null ? `${meal.fat.toFixed(1)}g` : "—"} />
            </View>
          </Section>

          {(meal.dietary_tags.length > 0 || meal.tags.length > 0 || meal.allergens.length > 0) && (
            <Section title="Classification">
              <View className="gap-2">
                {meal.dietary_tags.length > 0 && (
                  <View className="flex-row flex-wrap gap-1.5">
                    {meal.dietary_tags.map((t) => <Chip key={t} label={t} />)}
                  </View>
                )}
                {meal.tags.length > 0 && (
                  <View className="flex-row flex-wrap gap-1.5">
                    {meal.tags.map((t) => <Chip key={t} label={t} />)}
                  </View>
                )}
                {meal.allergens.length > 0 && (
                  <View className="flex-row flex-wrap gap-1.5">
                    {meal.allergens.map((t) => <Chip key={t} label={t} />)}
                  </View>
                )}
              </View>
            </Section>
          )}

          {meal.meal_ingredients.length > 0 && (
            <Section title="Ingredients">
              <View className="gap-2">
                {meal.meal_ingredients
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((mi) => {
                    const conversion =
                      mi.quantity_amount != null && mi.quantity_unit != null
                        ? convertQuantityToBasis(mi.quantity_amount, mi.quantity_unit, mi.ingredient)
                        : null;
                    const counted = countsTowardMealTotals(mi.ingredient);
                    return (
                      <View key={mi.id} className="gap-1.5 rounded-xl border border-ink-emphasis/10 p-3">
                        <View className="flex-row items-center justify-between">
                          <View className="flex-1 pr-2">
                            <AppText variant="body">{mi.ingredient.canonical_name}</AppText>
                            <AppText variant="caption" className="text-ink-subtle">
                              {mi.display_text} · {mi.ingredient.role}
                            </AppText>
                          </View>
                          <AppText variant="caption" className="text-ink-subtle">
                            {mi.ingredient.source ?? "manual"}
                          </AppText>
                        </View>
                        <AppText variant="caption" className="text-ink-subtle">
                          {bridgeLabel(mi.ingredient) ?? "no piece/ml bridge set"}
                        </AppText>
                        {conversion?.ok ? (
                          <AppText variant="caption" className={counted ? "text-primary" : "text-ink-subtle"}>
                            {contributionLabel(computeProposedTotals(mi.ingredient, conversion))}
                            {!counted && "  ·  pantry, not counted in total"}
                          </AppText>
                        ) : conversion && !conversion.ok ? (
                          <AppText variant="caption" className="text-like">
                            Can't calculate: {conversion.reason}
                          </AppText>
                        ) : (
                          <AppText variant="caption" className="text-ink-subtle">
                            No quantity set — not counted in total
                          </AppText>
                        )}
                      </View>
                    );
                  })}
              </View>
            </Section>
          )}

          {meal.procedure.length > 0 && (
            <Section title="Procedure">
              <View className="gap-2">
                {meal.procedure.map((step, i) => (
                  <View key={i} className="flex-row gap-3 rounded-xl border border-ink-emphasis/10 p-3">
                    <AppText variant="bodyBold" className="text-primary">
                      {i + 1}.
                    </AppText>
                    <AppText variant="body" className="flex-1">
                      {step}
                    </AppText>
                  </View>
                ))}
              </View>
            </Section>
          )}

          <View className="gap-2">
            <Button
              label={archiveMeal.isPending ? "Archiving..." : "Archive meal"}
              variant="outline"
              icon={<Archive color={colors.primary} size={16} />}
              disabled={archiveMeal.isPending}
              onPress={handleArchive}
            />
            <Pressable
              onPress={() => setConfirmDeleteVisible(true)}
              className="flex-row items-center justify-center gap-2 rounded-xl border border-like py-3.5"
            >
              <Trash2 color={colors.like} size={16} />
              <AppText variant="title" className="text-like">
                Delete meal
              </AppText>
            </Pressable>
          </View>
        </ScrollView>
      )}

      <BottomSheet visible={confirmDeleteVisible} onClose={() => setConfirmDeleteVisible(false)} heightPercent={0.4}>
        <View className="flex-1 px-8 pt-16 items-center">
          <AppText variant="heading" className="text-center mb-2">
            Delete this meal?
          </AppText>
          <AppText variant="body" className="text-ink-subtle text-center mb-8">
            {meal ? `"${meal.name}" will be removed from the catalog. This cannot be undone.` : ""}
          </AppText>
          <View className="w-full gap-2">
            <Pressable
              onPress={handleDelete}
              disabled={deleteMeal.isPending}
              className="items-center justify-center rounded-xl bg-like py-3.5"
            >
              <AppText variant="title" className="text-white">
                {deleteMeal.isPending ? "Deleting..." : "Delete"}
              </AppText>
            </Pressable>
            <Button
              label="Cancel"
              variant="outline"
              disabled={deleteMeal.isPending}
              onPress={() => setConfirmDeleteVisible(false)}
            />
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}
