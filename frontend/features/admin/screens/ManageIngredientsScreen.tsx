import { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { AppText, SegmentedSwitch, ErrorState, LoadingState, Screen, SearchBar, Toggle } from "@/frontend/components/ui";
import { useArchiveIngredient, useIngredients, useUpdateIngredient } from "../hooks/useIngredients";
import { IngredientListItem } from "../components/IngredientListItem";
import { IngredientEditSheet } from "../components/IngredientEditSheet";
import { FilterPill } from "../components/FilterPill";
import { UsdaGroundingPanel } from "../components/UsdaGroundingPanel";
import { FnriGroundingPanel } from "../components/FnriGroundingPanel";
import { PriceGroundingPanel } from "../components/PriceGroundingPanel";
import { PackEstimatePanel } from "../components/PackEstimatePanel";
import type { IngredientRow } from "@/api/ingredients";
import { AdminHeader } from "../components/AdminHeader";

const ROLE_OPTIONS = [
  { id: "main", label: "Main" },
  { id: "pantry", label: "Staple" },
];
const SOURCE_OPTIONS = [
  { id: "FNRI", label: "FNRI" },
  { id: "USDA", label: "USDA" },
  { id: "manual", label: "Manual" },
];

// 'price_watch' is a valid DB value but nothing writes it yet (Price Watch
// isn't built), so it's left out until it can actually match anything.
const PRICE_SOURCE_OPTIONS = [
  { id: "manual", label: "Manual / AI estimate" },
  { id: "supermarket", label: "Supermarket" },
  { id: "da", label: "DA Daily Price" },
];

type Tab = "all" | "usda" | "fnri" | "prices" | "packs";

export default function ManageIngredientsScreen() {
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string | undefined>();
  const [foodGroup, setFoodGroup] = useState<string | undefined>();
  const [source, setSource] = useState<string | undefined>();
  const [priceSource, setPriceSource] = useState<string | undefined>();
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<IngredientRow | null>(null);

  const filters = { search: search || undefined, role, foodGroup, source, priceSource, showArchived };
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
      <AdminHeader title="Manage Ingredients" subtitle={`${ingredients?.length ?? 0} ingredients`} />

      <View className="mb-4">
        {/* Five tabs: scrolls sideways on narrow phones rather than squeezing. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          <SegmentedSwitch<Tab>
            size="md"
            options={[
              { value: "all", label: "All" },
              { value: "usda", label: "USDA" },
              { value: "fnri", label: "FNRI" },
              { value: "prices", label: "Prices" },
              { value: "packs", label: "Packs" },
            ]}
            value={tab}
            onChange={setTab}
          />
        </ScrollView>
      </View>

      {tab === "usda" ? (
        <UsdaGroundingPanel />
      ) : tab === "prices" ? (
        <PriceGroundingPanel />
      ) : tab === "packs" ? (
        <PackEstimatePanel />
      ) : tab === "fnri" ? (
        <FnriGroundingPanel />
      ) : (
        <>
          <View className="px-5 mb-3">
            <SearchBar placeholder="Search ingredients..." value={search} onChangeText={setSearch} />
          </View>

          <View className="flex-row flex-wrap gap-2 px-5 mb-3">
            <FilterPill label="roles" value={role} options={ROLE_OPTIONS} onChange={setRole} />
            <FilterPill label="food groups" value={foodGroup} options={foodGroupOptions} onChange={setFoodGroup} />
            <FilterPill label="sources" value={source} options={SOURCE_OPTIONS} onChange={setSource} />
            <FilterPill
              label="price sources"
              value={priceSource}
              options={PRICE_SOURCE_OPTIONS}
              onChange={setPriceSource}
            />
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
