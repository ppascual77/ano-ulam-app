import { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { AppText, ErrorState, LoadingState, Screen, SearchBar, Toggle } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useArchiveIngredient, useIngredients, useUpdateIngredient } from "../hooks/useIngredients";
import { IngredientListItem } from "../components/IngredientListItem";
import { IngredientEditSheet } from "../components/IngredientEditSheet";
import { FilterPill } from "../components/FilterPill";
import { UsdaGroundingPanel } from "../components/UsdaGroundingPanel";
import { PriceGroundingPanel } from "../components/PriceGroundingPanel";
import type { IngredientRow } from "@/api/ingredients";

const ROLE_OPTIONS = [
  { id: "main", label: "Main" },
  { id: "pantry", label: "Pantry" },
];
const SOURCE_OPTIONS = [
  { id: "FNRI", label: "FNRI" },
  { id: "USDA", label: "USDA" },
  { id: "manual", label: "Manual" },
];

type Tab = "all" | "usda" | "fnri" | "prices";

export default function ManageIngredientsScreen() {
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string | undefined>();
  const [foodGroup, setFoodGroup] = useState<string | undefined>();
  const [source, setSource] = useState<string | undefined>();
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<IngredientRow | null>(null);

  const filters = { search: search || undefined, role, foodGroup, source, showArchived };
  const { data: ingredients, isLoading, isError } = useIngredients(filters);
  // Unfiltered fetch, just to derive the set of food groups actually in use
  // for the filter dropdown (independent of role/source/search narrowing).
  const { data: allIngredients } = useIngredients({ showArchived: true });

  const foodGroupOptions = useMemo(() => {
    const groups = new Set((allIngredients ?? []).map((i) => i.food_group).filter(Boolean) as string[]);
    return Array.from(groups)
      .sort()
      .map((g) => ({ id: g, label: g }));
  }, [allIngredients]);

  const updateIngredient = useUpdateIngredient();
  const archiveIngredient = useArchiveIngredient();

  const handleSave = (patch: Partial<IngredientRow>) => {
    if (!editing) return;
    updateIngredient.mutate(
      { id: editing.id, patch },
      { onSuccess: () => setEditing(null) },
    );
  };

  return (
    <Screen padded={false}>
      <View className="px-5 pt-2 pb-4 flex-row items-center gap-2">
        <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center">
          <ArrowLeft color={colors.ink.emphasis} size={18} />
        </Pressable>
        <View>
          <AppText variant="eyebrow">Admin</AppText>
          <AppText variant="heading">Manage Ingredients</AppText>
          <AppText variant="caption" className="text-ink-subtle">
            {ingredients?.length ?? 0} ingredients
          </AppText>
        </View>
      </View>

      <View className="flex-row gap-5 px-5 border-b border-ink-emphasis/10 mb-4">
        {(
          [
            { id: "all", label: "All Ingredients" },
            { id: "usda", label: "Ground from USDA" },
            { id: "fnri", label: "Ground from FNRI" },
            { id: "prices", label: "Ground Prices" },
          ] as const
        ).map((t) => (
          <Pressable key={t.id} onPress={() => setTab(t.id)} className="pb-3">
            <AppText
              variant={tab === t.id ? "bodyBold" : "body"}
              className={tab === t.id ? "text-primary" : "text-ink-subtle"}
            >
              {t.label}
            </AppText>
          </Pressable>
        ))}
      </View>

      {tab === "usda" ? (
        <UsdaGroundingPanel />
      ) : tab === "prices" ? (
        <PriceGroundingPanel />
      ) : tab === "fnri" ? (
        <View className="flex-1 items-center justify-center px-10">
          <AppText variant="body" className="text-ink-subtle text-center">
            Not built yet — FNRI import is future work (its existing data structure is more manual, see
            docs/ingredient-data-architecture.md section 21).
          </AppText>
        </View>
      ) : (
        <>
          <View className="px-5 mb-3">
            <SearchBar placeholder="Search ingredients..." value={search} onChangeText={setSearch} />
          </View>

          <View className="flex-row flex-wrap gap-2 px-5 mb-3">
            <FilterPill label="roles" value={role} options={ROLE_OPTIONS} onChange={setRole} />
            <FilterPill label="food groups" value={foodGroup} options={foodGroupOptions} onChange={setFoodGroup} />
            <FilterPill label="sources" value={source} options={SOURCE_OPTIONS} onChange={setSource} />
            <Pressable
              onPress={() => setShowArchived((v) => !v)}
              className="flex-row items-center gap-2 rounded-full border border-ink-emphasis/10 px-3 py-2"
            >
              <AppText variant="caption">Show archived</AppText>
              <Toggle checked={showArchived} onChange={setShowArchived} />
            </Pressable>
          </View>

          {isLoading ? (
            <LoadingState />
          ) : isError ? (
            <ErrorState />
          ) : (
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              {(ingredients ?? []).map((item) => (
                <IngredientListItem
                  key={item.id}
                  ingredient={item}
                  onEdit={() => setEditing(item)}
                  onArchive={() => archiveIngredient.mutate(item.id)}
                />
              ))}
            </ScrollView>
          )}
        </>
      )}

      <IngredientEditSheet
        visible={!!editing}
        onClose={() => setEditing(null)}
        ingredient={editing}
        onSave={handleSave}
        isSaving={updateIngredient.isPending}
      />
    </Screen>
  );
}
