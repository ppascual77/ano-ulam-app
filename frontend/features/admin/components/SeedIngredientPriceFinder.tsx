import { useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react-native";
import { AppText, Button, TextField } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import {
  applyPriceMatch,
  type IngredientRow,
  type PriceGroundingCandidate,
  type PriceGroundingResult,
} from "@/api/ingredients";
import {
  commoditiesByIngredient,
  daPriceOption,
  formatDaUnit,
  ingredientPricePatch,
  linkDaCommodity,
  linkedDaPrices,
  type DaCommodityRow,
} from "@/api/daPrices";
import { scoreIngredientMatch } from "@/api/meals";
import { errorMessage } from "@/lib/errorMessage";
import { useDaCommodities } from "../hooks/useDaPrices";
import { useGroundIngredientPrices, useMarkPriceGroundingAttempted } from "../hooks/useIngredients";
import { useConfirmedIngredientUpdate } from "../hooks/useConfirmedIngredientUpdate";
import { ConfirmIngredientUpdateSheet } from "./ConfirmIngredientUpdateSheet";
import { Checkbox } from "./Checkbox";

const DA_SUGGESTIONS = 6;
const SOURCE_LABEL: Record<string, string> = {
  manual: "AI estimate, not from a real source yet",
  da: "DA wet market price",
  supermarket: "supermarket listing",
  price_watch: "Price Watch",
};
const DA_SEARCH_LIMIT = 15;

// Seed Meal: a real price for the linked ingredient, mainly for new ones
// whose price is still an AI estimate (price_source "manual", how both of
// Seed Meal's "add new ingredient" paths leave it). Same two sources as the
// admin screens:
// DA commodities to link (free, instant) and a supermarket lookup (paid,
// same edge function as Ground Prices). The cheapest ticked source becomes
// the price, through the usual affected-meals confirmation.
export function SeedIngredientPriceFinder({ ingredient }: { ingredient: IngredientRow }) {
  const queryClient = useQueryClient();
  const { data: commodities } = useDaCommodities();
  const groundPrices = useGroundIngredientPrices();
  const markAttempted = useMarkPriceGroundingAttempted();
  const confirmedUpdate = useConfirmedIngredientUpdate();

  const [daOpen, setDaOpen] = useState(false);
  const [daSearch, setDaSearch] = useState("");
  const [daPicked, setDaPicked] = useState<Set<string>>(new Set());
  const [supermarket, setSupermarket] = useState<PriceGroundingResult | null>(null);
  const [marketPicked, setMarketPicked] = useState<Set<number>>(new Set());
  // DA commodities to link once the price write is confirmed.
  const [pendingLinks, setPendingLinks] = useState<string[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const alreadyLinked = useMemo(
    () => commoditiesByIngredient(commodities ?? []).get(ingredient.id) ?? [],
    [commodities, ingredient.id],
  );
  const commodityById = useMemo(() => new Map((commodities ?? []).map((c) => [c.id, c])), [commodities]);

  // Name-match suggestions; typing searches every priced, unlinked commodity
  // instead. Ones linked to another ingredient are left out: moving them
  // re-prices that ingredient too, which DA Daily Prices → Link handles.
  const daResults = useMemo(() => {
    const priced = (commodities ?? []).filter((c) => c.latest_price != null && !c.ingredient_id);
    const q = daSearch.trim().toLowerCase();
    if (q) {
      return priced.filter((c) => `${c.commodity} ${c.specification}`.toLowerCase().includes(q)).slice(0, DA_SEARCH_LIMIT);
    }
    return priced
      .map((c) => ({ c, score: scoreIngredientMatch(`${c.commodity} ${c.specification}`, ingredient) }))
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, DA_SUGGESTIONS)
      .map((m) => m.c);
  }, [commodities, daSearch, ingredient]);

  const marketCandidates: PriceGroundingCandidate[] =
    supermarket && (supermarket.confidence === "HIGH" || supermarket.confidence === "LOW") ? supermarket.candidates ?? [] : [];

  const toggleDa = (id: string) =>
    setDaPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleMarket = (i: number) =>
    setMarketPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const handleSearchSupermarkets = async () => {
    setError(null);
    setNotice(null);
    try {
      const [result] = await groundPrices.mutateAsync([ingredient]);
      setSupermarket(result ?? null);
      if (result && (result.confidence === "HIGH" || result.confidence === "LOW")) {
        setMarketPicked(new Set((result.candidates ?? []).flatMap((c, i) => (c.confidence === "HIGH" ? [i] : []))));
      }
      // Same as Ground Prices: an ERROR says nothing about the ingredient,
      // so only a real answer counts as checked.
      if (result && result.confidence !== "ERROR") markAttempted.mutate([ingredient.id]);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const picking = daPicked.size + marketPicked.size;

  const handleApply = async () => {
    setError(null);
    setNotice(null);
    const newLinks = [...daPicked];
    const linked = [...alreadyLinked, ...newLinks.flatMap((id) => commodityById.get(id) ?? [])];
    const pickedListings = marketCandidates.filter((_, i) => marketPicked.has(i));
    const patch =
      pickedListings.length > 0
        ? applyPriceMatch(
            ingredient,
            pickedListings,
            linkedDaPrices(linked).flatMap(({ commodity, price }) => daPriceOption(commodity, price, ingredient) ?? []),
          )
        : ingredientPricePatch(ingredient, linkedDaPrices(linked));

    if (!patch) {
      // DA links only, and the price doesn't change (e.g. a supermarket
      // listing is still cheaper), so there's nothing to confirm.
      setApplying(true);
      try {
        await saveLinks(newLinks);
        setNotice(newLinks.length > 0 ? "Linked. Price unchanged." : "Price unchanged.");
        reset();
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setApplying(false);
      }
      return;
    }
    setPendingLinks(newLinks);
    await confirmedUpdate.requestUpdate([{ id: ingredient.id, patch, name: ingredient.canonical_name }]);
  };

  const saveLinks = async (ids: string[]) => {
    for (const id of ids) await linkDaCommodity(id, ingredient.id);
    queryClient.invalidateQueries({ queryKey: ["admin", "da"] });
  };

  const reset = () => {
    setDaOpen(false);
    setDaSearch("");
    setDaPicked(new Set());
    setSupermarket(null);
    setMarketPicked(new Set());
  };

  const handleConfirm = async () => {
    const patch = confirmedUpdate.pending?.[0]?.patch;
    setApplying(true);
    try {
      await saveLinks(pendingLinks ?? []);
      await confirmedUpdate.confirm();
      // Seed Meal's ingredient list (and so this row's totals) is cached
      // under the meals key.
      await queryClient.invalidateQueries({ queryKey: ["admin", "meals"] });
      if (patch) {
        const source = patch.price_source === "da" ? "DA" : "supermarket";
        setNotice(`Price now ₱${patch.estimated_price}/${patch.estimated_price_unit} (${source}).`);
      }
      reset();
    } catch (err) {
      confirmedUpdate.cancel();
      setError(errorMessage(err));
    } finally {
      setPendingLinks(null);
      setApplying(false);
    }
  };

  const handleCancel = () => {
    confirmedUpdate.cancel();
    setPendingLinks(null);
  };

  return (
    <View className="gap-2 rounded-xl border border-ink-emphasis/10 px-3 py-2">
      <AppText variant="caption" className="text-ink-subtle">
        Price: {ingredient.estimated_price != null ? `₱${ingredient.estimated_price}/${ingredient.estimated_price_unit}` : "none"} ·{" "}
        {SOURCE_LABEL[ingredient.price_source] ?? ingredient.price_source}
      </AppText>

      {notice && (
        <AppText variant="caption" className="text-primary">
          {notice}
        </AppText>
      )}

      <View className="flex-row flex-wrap gap-4">
        <Pressable onPress={() => setDaOpen((v) => !v)} hitSlop={6}>
          <AppText variant="caption" className="text-primary">
            {daOpen ? "Hide DA prices" : "Find DA price"}
          </AppText>
        </Pressable>
        <Pressable
          onPress={handleSearchSupermarkets}
          disabled={groundPrices.isPending}
          hitSlop={6}
          className="flex-row items-center gap-2"
        >
          {groundPrices.isPending && <ActivityIndicator size="small" color={colors.primary} />}
          <AppText variant="caption" className="text-primary">
            {groundPrices.isPending ? "Searching supermarkets (10-30s)..." : "Search supermarkets (~3¢)"}
          </AppText>
        </Pressable>
      </View>

      {daOpen && (
        <View className="gap-1">
          {alreadyLinked.length > 0 && (
            <AppText variant="caption" className="text-primary">
              Already linked: {alreadyLinked.map((c) => c.commodity).join(", ")}
            </AppText>
          )}
          <TextField label="Search DA commodities" value={daSearch} onChangeText={setDaSearch} />
          {daResults.length === 0 && (
            <AppText variant="caption" className="text-ink-subtle">
              {daSearch ? "No DA commodity matches." : "No name match. Search for it, or DA may not track it."}
            </AppText>
          )}
          {daResults.map((c) => (
            <DaOption
              key={c.id}
              commodity={c}
              checked={daPicked.has(c.id)}
              onToggle={() => toggleDa(c.id)}
            />
          ))}
        </View>
      )}

      {supermarket?.confidence === "NONE" && (
        <AppText variant="caption" className="text-ink-subtle">
          No supermarket listing found: {supermarket.reason}
        </AppText>
      )}
      {supermarket?.confidence === "ERROR" && (
        <AppText variant="caption" className="text-like">
          Supermarket search failed: {supermarket.error}
        </AppText>
      )}
      {marketCandidates.map((c, i) => (
        <Pressable key={c.url} onPress={() => toggleMarket(i)} className="flex-row items-start gap-3">
          <Checkbox checked={marketPicked.has(i)} />
          <View className="flex-1">
            <AppText variant="body">
              {c.store} · ₱{Math.round(c.pricePerUnit)}/{c.unit}{" "}
              <AppText variant="caption" className={c.confidence === "HIGH" ? "text-primary" : "text-accent"}>
                {c.confidence}
              </AppText>
            </AppText>
            <Pressable onPress={() => Linking.openURL(c.url)} className="flex-row items-center gap-1">
              <AppText variant="caption" className="text-ink-subtle flex-shrink">
                {c.productTitle} · ₱{c.packPrice} / {c.packSize}
                {c.packUnit === "piece" ? " pc" : c.packUnit}
              </AppText>
              <ExternalLink color={colors.ink.subtle} size={12} />
            </Pressable>
          </View>
        </Pressable>
      ))}

      {error && (
        <AppText variant="caption" className="text-like">
          {error}
        </AppText>
      )}

      {picking > 0 && (
        <Button
          label={applying ? "Saving..." : `Use ${picking} source${picking === 1 ? "" : "s"} (cheapest wins)`}
          disabled={applying || confirmedUpdate.loadingAffected}
          onPress={handleApply}
        />
      )}

      <ConfirmIngredientUpdateSheet
        pending={confirmedUpdate.pending}
        affectedMeals={confirmedUpdate.affectedMeals}
        loading={confirmedUpdate.loadingAffected}
        isSaving={confirmedUpdate.isSaving || applying}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </View>
  );
}

function DaOption({ commodity, checked, onToggle }: { commodity: DaCommodityRow; checked: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} className="flex-row items-start gap-3 py-1">
      <Checkbox checked={checked} />
      <View className="flex-1">
        <AppText variant="body">{commodity.commodity}</AppText>
        {!!commodity.specification && (
          <AppText variant="caption" className="text-ink-subtle">
            {commodity.specification}
          </AppText>
        )}
      </View>
      <AppText variant="bodyBold">
        ₱{commodity.latest_price!.toFixed(2)}/{formatDaUnit(commodity)}
      </AppText>
    </Pressable>
  );
}
