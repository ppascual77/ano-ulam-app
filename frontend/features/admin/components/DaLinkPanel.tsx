import { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { AppText, ErrorState, LoadingState, SearchBar, SegmentedSwitch, Spinner } from "@/frontend/components/ui";
import {
  commoditiesByIngredient,
  formatDaUnit,
  ingredientPricePatch,
  linkedDaPrices,
  type DaCommodityRow,
} from "@/api/daPrices";
import type { IngredientRow } from "@/api/ingredients";
import { errorMessage } from "@/lib/errorMessage";
import { useDaCommodities, useLinkDaCommodity } from "../hooks/useDaPrices";
import { useIngredients } from "../hooks/useIngredients";
import { useConfirmedIngredientUpdate, type PendingIngredientChange } from "../hooks/useConfirmedIngredientUpdate";
import { ConfirmIngredientUpdateSheet } from "./ConfirmIngredientUpdateSheet";
import { LinkDaCommoditySheet } from "./LinkDaCommoditySheet";

type Filter = "unlinked" | "linked";

// Links each DA commodity to the ingredient it prices (an ingredient can
// have several, e.g. Bangus ← "Bangus, Large" and "Bangus, Medium"). Each
// DA price becomes one of that ingredient's price sources,
// next to its supermarket listings, and the cheapest source is its price;
// later daily saves keep the DA side current.
export function DaLinkPanel() {
  const commodities = useDaCommodities();
  const { data: ingredients } = useIngredients({ showArchived: false });
  const link = useLinkDaCommodity();
  const confirmedUpdate = useConfirmedIngredientUpdate();

  const [filter, setFilter] = useState<Filter>("unlinked");
  const [search, setSearch] = useState("");
  const [linking, setLinking] = useState<DaCommodityRow | null>(null);
  // The ingredient picked in LinkDaCommoditySheet, acted on once that sheet
  // has fully closed (see handleSheetClosed).
  const [picked, setPicked] = useState<{ commodity: DaCommodityRow; ingredient: IngredientRow } | null>(null);
  const [pendingLink, setPendingLink] = useState<{
    commodityId: string;
    ingredientId: string | null;
    notice: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const ingredientById = useMemo(() => new Map((ingredients ?? []).map((i) => [i.id, i])), [ingredients]);
  const linkedTo = useMemo(() => commoditiesByIngredient(commodities.data ?? []), [commodities.data]);

  const all = commodities.data ?? [];
  const linkedCount = all.filter((c) => c.ingredient_id).length;
  const q = search.trim().toLowerCase();
  const shown = all.filter(
    (c) =>
      (filter === "linked") === !!c.ingredient_id &&
      (!q || `${c.commodity} ${c.specification}`.toLowerCase().includes(q)),
  );

  // Links `commodity` to `target` (null = unlink) and re-prices every
  // ingredient whose DA sources change: the target gains this commodity, and
  // the ingredient it was linked to before (if any) loses it. Price writes go
  // through the affected-meals confirmation first.
  const relink = async (commodity: DaCommodityRow, target: IngredientRow | null) => {
    setError(null);
    setNotice(null);
    const others = (ingredientId: string) => (linkedTo.get(ingredientId) ?? []).filter((c) => c.id !== commodity.id);
    const changes: PendingIngredientChange[] = [];
    const prices: string[] = [];
    const reprice = (ingredient: IngredientRow, linked: DaCommodityRow[]) => {
      const patch = ingredientPricePatch(ingredient, linkedDaPrices(linked));
      if (!patch) return;
      changes.push({ id: ingredient.id, patch, name: ingredient.canonical_name });
      const source = patch.price_source === "da" ? "DA" : "supermarket";
      prices.push(`${ingredient.canonical_name} now ₱${patch.estimated_price}/${patch.estimated_price_unit} (${source})`);
    };
    if (target) reprice(target, [...others(target.id), commodity]);
    const previous = commodity.ingredient_id ? ingredientById.get(commodity.ingredient_id) : undefined;
    if (previous && previous.id !== target?.id) reprice(previous, others(previous.id));

    const what = target
      ? `Linked ${commodity.commodity} → ${target.canonical_name}`
      : `Unlinked ${commodity.commodity} from ${previous?.canonical_name ?? "its ingredient"}`;
    const message = `${what}. ${prices.length > 0 ? `${prices.join(", ")}.` : "Price unchanged."}`;
    try {
      if (changes.length === 0) {
        await link.mutateAsync({ commodityId: commodity.id, ingredientId: target?.id ?? null });
        setNotice(message);
        return;
      }
      setPendingLink({ commodityId: commodity.id, ingredientId: target?.id ?? null, notice: message });
      await confirmedUpdate.requestUpdate(changes);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const handlePick = (ingredient: IngredientRow) => {
    if (linking) setPicked({ commodity: linking, ingredient });
    setLinking(null);
  };

  // Only once the link sheet's Modal is gone: the confirm sheet is a second
  // Modal, and presenting it while the first is still closing silently
  // no-ops (see BottomSheet's onClosed).
  const handleSheetClosed = () => {
    if (!picked) return;
    setPicked(null);
    void relink(picked.commodity, picked.ingredient);
  };

  // Unlinking drops this DA price from the ingredient's sources: its price
  // goes to the cheapest remaining source, or stays as is when it has none.
  const handleUnlink = (commodity: DaCommodityRow) => relink(commodity, null);

  const handleConfirm = async () => {
    if (!pendingLink) return;
    try {
      await link.mutateAsync({ commodityId: pendingLink.commodityId, ingredientId: pendingLink.ingredientId });
      await confirmedUpdate.confirm();
      setNotice(pendingLink.notice);
    } catch (err) {
      confirmedUpdate.cancel();
      setError(errorMessage(err));
    } finally {
      setPendingLink(null);
    }
  };

  const handleCancel = () => {
    confirmedUpdate.cancel();
    setPendingLink(null);
  };

  if (commodities.isLoading) return <LoadingState />;
  if (commodities.isError) return <ErrorState />;

  return (
    <View className="flex-1">
      <View className="px-5 gap-3 mb-3">
        {all.length === 0 ? (
          <AppText variant="body" className="text-ink-subtle">
            No DA commodities yet. Save a day from the Import tab first.
          </AppText>
        ) : (
          <>
            <SegmentedSwitch
              options={[
                { value: "unlinked", label: `Unlinked (${all.length - linkedCount})` },
                { value: "linked", label: `Linked (${linkedCount})` },
              ]}
              value={filter}
              onChange={setFilter}
            />
            <SearchBar placeholder="Search DA commodities..." value={search} onChangeText={setSearch} onClear={() => setSearch("")} />
          </>
        )}
        {notice && (
          <AppText variant="bodyBold" className="text-primary">
            {notice}
          </AppText>
        )}
        {error && (
          <AppText variant="body" className="text-like">
            {error}
          </AppText>
        )}
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
        {shown.map((c) => {
          const ingredient = c.ingredient_id ? ingredientById.get(c.ingredient_id) : undefined;
          // From picking an ingredient until the link is saved or cancelled.
          const busy =
            picked?.commodity.id === c.id ||
            pendingLink?.commodityId === c.id ||
            (link.isPending && link.variables?.commodityId === c.id);
          return (
            <Pressable
              key={c.id}
              onPress={() => setLinking(c)}
              disabled={busy}
              className="flex-row items-start gap-3 border-b border-ink-emphasis/10 py-3 active:bg-primary/5"
            >
              <View className="flex-1">
                <AppText variant="bodyMedium">{c.commodity}</AppText>
                {!!c.specification && (
                  <AppText variant="caption" className="text-ink-subtle">
                    {c.specification}
                  </AppText>
                )}
                {busy ? (
                  <View className="flex-row items-center gap-2">
                    <Spinner size={14} />
                    <AppText variant="caption" className="text-ink-subtle">
                      Saving link...
                    </AppText>
                  </View>
                ) : c.ingredient_id ? (
                  <View className="flex-row items-center gap-3">
                    <AppText variant="caption" className="text-primary">
                      → {ingredient?.canonical_name ?? "Archived ingredient"}
                    </AppText>
                    <Pressable onPress={() => handleUnlink(c)} hitSlop={8}>
                      <AppText variant="caption" className="text-like">
                        Unlink
                      </AppText>
                    </Pressable>
                  </View>
                ) : (
                  <AppText variant="caption" className="text-accent">
                    Tap to link
                  </AppText>
                )}
              </View>
              <View className="items-end">
                <AppText variant="bodyBold">
                  {c.latest_price != null ? `₱${c.latest_price.toFixed(2)}/${formatDaUnit(c)}` : "No price"}
                </AppText>
                {c.latest_price_date && (
                  <AppText variant="caption" className="text-ink-subtle">
                    {c.latest_price_date}
                  </AppText>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <LinkDaCommoditySheet
        commodity={linking}
        ingredients={ingredients ?? []}
        linkedTo={linkedTo}
        onPick={handlePick}
        onClose={() => setLinking(null)}
        onClosed={handleSheetClosed}
      />
      <ConfirmIngredientUpdateSheet
        pending={confirmedUpdate.pending}
        affectedMeals={confirmedUpdate.affectedMeals}
        loading={confirmedUpdate.loadingAffected}
        isSaving={confirmedUpdate.isSaving || link.isPending}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </View>
  );
}
