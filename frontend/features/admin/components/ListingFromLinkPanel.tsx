import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { AppText, Button, LoadingState, SegmentedSwitch, TextField } from "@/frontend/components/ui";
import { IngredientSearch } from "@/frontend/core/meals/components/IngredientSearch";
import { ingredientPricePerUnit, packEstimateOf, type IngredientRow, type PriceOption } from "@/api/ingredients";
import {
  ListingNeedsInput,
  addListingPatch,
  fetchListingFromUrl,
  manualListing,
  storeFromUrl,
  type FetchedListing,
  type StoreListing,
} from "@/api/storeListings";
import { commoditiesByIngredient, daPriceOption, linkedDaPrices } from "@/api/daPrices";
import { errorMessage } from "@/lib/errorMessage";
import { useIngredients } from "../hooks/useIngredients";
import { useDaCommodities } from "../hooks/useDaPrices";
import { useConfirmedIngredientUpdate } from "../hooks/useConfirmedIngredientUpdate";
import { ConfirmIngredientUpdateSheet } from "./ConfirmIngredientUpdateSheet";

// A price this far off the current one (either way) gets a second look,
// e.g. a 10 kg sack read as the usual pack.
const BIG_CHANGE_RATIO = 3;

const PACK_UNITS: { value: StoreListing["packUnit"]; label: string }[] = [
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "ml", label: "ml" },
  { value: "L", label: "L" },
];

// Dishes and water: nothing to look up in a store.
const NOT_IN_STORES = new Set(["dessert", "street food", "water"]);

// Still to check: priced by hand or AI (price_source "manual"), the ones
// worth finding a real store price for. "packs": just those with an AI pack
// estimate (the grocery list's "~" items).
type ToCheckFilter = "all" | "packs";

// The manual form's fields, as typed.
type ManualForm = { store: string; productTitle: string; price: string; size: string; unit: StoreListing["packUnit"] };

const toNumber = (text: string) => Number(text.replace(/[₱,\s]/g, ""));

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

// Add a store listing from a product link: pick the ingredient, paste an SM
// Markets link, check the preview, save. Any other link (or none, e.g. a
// market stall) opens a short manual form instead: price and pack size typed
// from the page, then the same preview and save. Saving goes through the usual
// confirm (affected meals listed and recomputed), so it's the manual
// counterpart of Ground Prices, without a paid search.
export function ListingFromLinkPanel() {
  const { data: ingredients, isLoading } = useIngredients({ showArchived: false });
  const byId = useMemo(() => new Map((ingredients ?? []).map((i) => [i.id, i])), [ingredients]);
  const [ingredientId, setIngredientId] = useState<string | null>(null);
  const ingredient = ingredientId ? byId.get(ingredientId) : undefined;

  const [link, setLink] = useState("");
  const [fetching, setFetching] = useState(false);
  const [listing, setListing] = useState<FetchedListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [toCheckFilter, setToCheckFilter] = useState<ToCheckFilter>("all");
  const toCheck = useMemo(
    () =>
      (ingredients ?? [])
        .filter((i) => (i.price_source ?? "manual") === "manual" && !NOT_IN_STORES.has(i.category?.trim().toLowerCase() ?? ""))
        .sort((a, b) => a.canonical_name.localeCompare(b.canonical_name)),
    [ingredients],
  );
  const packEstimates = useMemo(() => toCheck.filter((i) => packEstimateOf(i.price_sources)), [toCheck]);
  const toCheckShown = toCheckFilter === "packs" ? packEstimates : toCheck;
  const [manual, setManual] = useState<ManualForm | null>(null);
  // Why the manual form opened (informational, not an error).
  const [manualReason, setManualReason] = useState<string | null>(null);
  const confirmedUpdate = useConfirmedIngredientUpdate();

  // Linked DA prices stay among its sources, so a cheaper DA price isn't
  // overwritten by a store one.
  const { data: daCommodities } = useDaCommodities();
  const daByIngredient = useMemo(() => commoditiesByIngredient(daCommodities ?? []), [daCommodities]);
  const daOptionsFor = (row: IngredientRow): PriceOption[] =>
    linkedDaPrices(daByIngredient.get(row.id) ?? []).flatMap(({ commodity, price }) => daPriceOption(commodity, price, row) ?? []);

  const reset = () => {
    setLink("");
    setListing(null);
    setError(null);
    setManual(null);
    setManualReason(null);
  };

  const openManual = (prefill: Partial<ManualForm> = {}, reason: string | null = null) => {
    setListing(null);
    setError(null);
    setManualReason(reason);
    setManual({ store: storeFromUrl(link), productTitle: "", price: "", size: "", unit: "g", ...prefill });
  };

  const manualValid =
    !!manual && !!manual.store.trim() && !!manual.productTitle.trim() && toNumber(manual.price) > 0 && toNumber(manual.size) > 0;

  const handleManualPreview = () => {
    if (!ingredient || !manual || !manualValid) return;
    setListing(
      manualListing(
        {
          url: link,
          store: manual.store,
          productTitle: manual.productTitle,
          packPrice: toNumber(manual.price),
          packSize: toNumber(manual.size),
          packUnit: manual.unit,
        },
        ingredient,
      ),
    );
  };

  const handleFetch = async () => {
    if (!ingredient) return;
    setFetching(true);
    setError(null);
    setListing(null);
    setSaved(null);
    try {
      setListing(await fetchListingFromUrl(link, ingredient));
    } catch (err) {
      if (err instanceof ListingNeedsInput) {
        const { partial } = err;
        openManual(
          {
            store: partial.store ?? "",
            productTitle: partial.productTitle ?? "",
            price: partial.packPrice ? String(partial.packPrice) : "",
          },
          err.message,
        );
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setFetching(false);
    }
  };

  const patch = ingredient && listing ? addListingPatch(ingredient, listing, daOptionsFor(ingredient)) : null;

  const handleSave = async () => {
    if (!ingredient || !patch) return;
    await confirmedUpdate.requestUpdate([{ id: ingredient.id, patch, name: ingredient.canonical_name }]);
  };

  const handleConfirm = async () => {
    const name = ingredient?.canonical_name ?? "";
    try {
      await confirmedUpdate.confirm();
      reset();
      setSaved(name);
    } catch (err) {
      confirmedUpdate.cancel();
      setError(errorMessage(err));
    }
  };

  if (isLoading) return <LoadingState />;

  const current = ingredient ? ingredientPricePerUnit(ingredient) : null;
  // What the ingredient's price becomes: unchanged when a cheaper source
  // (another listing, DA) still wins.
  const next =
    patch?.estimated_price != null && patch.estimated_price_unit
      ? { price: patch.estimated_price, unit: patch.estimated_price_unit }
      : current
        ? { price: current.pricePerUnit, unit: current.unit }
        : null;
  const ratio = listing && current && current.unit === listing.unit ? listing.pricePerUnit / current.pricePerUnit : null;
  const bigChange = ratio != null && (ratio > BIG_CHANGE_RATIO || ratio < 1 / BIG_CHANGE_RATIO);

  return (
    <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <AppText variant="body" className="mb-4 text-ink-subtle">
        Paste a product link to add it as one of an ingredient&apos;s store prices. SM Markets links are read
        automatically; any other store (or a price with no link) you enter by hand. The ingredient takes the cheapest of
        its real prices; its AI pack estimate is removed. Nothing is saved until you confirm.
      </AppText>

      {ingredient ? (
        <View className="mb-4 flex-row items-center justify-between rounded-2xl border border-ink-emphasis/10 px-4 py-3">
          <View className="flex-1">
            <AppText variant="bodyBold">{ingredient.canonical_name}</AppText>
            <AppText variant="caption" className="text-ink-subtle">
              {current ? `${peso(current.pricePerUnit)}/${current.unit}` : "No price"} · {ingredient.price_source ?? "manual"}
            </AppText>
          </View>
          <Pressable
            onPress={() => {
              setIngredientId(null);
              reset();
            }}
            hitSlop={8}
          >
            <AppText variant="caption" className="text-primary">
              Change
            </AppText>
          </Pressable>
        </View>
      ) : (
        <View className="mb-4">
          <IngredientSearch
            placeholder="Which ingredient? (e.g. fettuccine)"
            onPick={(picked) => {
              setIngredientId(picked.id);
              setSaved(null);
            }}
          />

          {/* What still has no real price: tap one to add its store price. */}
          <View className="mt-6 gap-3">
            <AppText variant="bodyBold">Still priced by hand or AI ({toCheck.length})</AppText>
            <SegmentedSwitch<ToCheckFilter>
              options={[
                { value: "all", label: `All (${toCheck.length})` },
                { value: "packs", label: `Pack estimates (${packEstimates.length})` },
              ]}
              value={toCheckFilter}
              onChange={setToCheckFilter}
            />
          </View>
          <View className="mt-2">
            {toCheckShown.map((row) => {
              const own = ingredientPricePerUnit(row);
              const pack = packEstimateOf(row.price_sources);
              return (
                <Pressable
                  key={row.id}
                  onPress={() => {
                    setIngredientId(row.id);
                    setSaved(null);
                  }}
                  className="flex-row items-center gap-3 border-b border-ink-emphasis/10 py-3 active:opacity-60"
                >
                  <View className="flex-1">
                    <AppText variant="body">{row.canonical_name}</AppText>
                    <AppText variant="caption" className="text-ink-subtle">
                      {row.category ?? "No category"}
                      {pack ? ` · AI pack: ${pack.productTitle}` : ""}
                    </AppText>
                  </View>
                  <AppText variant="caption" className="text-ink-subtle">
                    {own ? `${peso(own.pricePerUnit)}/${own.unit}` : "No price"}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {ingredient && (
        <View className="gap-3">
          <TextField
            label="SM Markets product link"
            value={link}
            onChangeText={(text) => {
              setLink(text);
              setListing(null);
              setError(null);
              setManual(null);
              setManualReason(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Button label="Get price" loading={fetching} disabled={!link.trim() || fetching} onPress={handleFetch} />
          {!manual && (
            <Pressable onPress={() => openManual()} hitSlop={8} className="self-center">
              <AppText variant="caption" className="text-primary">
                Enter by hand instead (no link, or another store)
              </AppText>
            </Pressable>
          )}
        </View>
      )}

      {ingredient && manual && (
        <View className="mt-5 gap-3 rounded-2xl border border-ink-emphasis/10 p-4">
          {manualReason && (
            <AppText variant="caption" className="text-ink-subtle">
              {manualReason}
            </AppText>
          )}
          <TextField
            label="Store"
            value={manual.store}
            onChangeText={(store) => {
              setManual({ ...manual, store });
              setListing(null);
            }}
            autoCapitalize="none"
          />
          <TextField
            label="Product (as on the page)"
            value={manual.productTitle}
            onChangeText={(productTitle) => {
              setManual({ ...manual, productTitle });
              setListing(null);
            }}
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextField
                label="Price"
                value={manual.price}
                onChangeText={(price) => {
                  setManual({ ...manual, price });
                  setListing(null);
                }}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1">
              <TextField
                label="Pack size"
                value={manual.size}
                onChangeText={(size) => {
                  setManual({ ...manual, size });
                  setListing(null);
                }}
                keyboardType="decimal-pad"
                suffix={manual.unit}
              />
            </View>
          </View>
          <SegmentedSwitch
            options={PACK_UNITS}
            value={manual.unit}
            onChange={(unit) => {
              setManual({ ...manual, unit });
              setListing(null);
            }}
          />
          <Button label="Preview" disabled={!manualValid} onPress={handleManualPreview} />
        </View>
      )}

      {error && (
        <AppText variant="body" className="mt-3 text-like">
          {error}
        </AppText>
      )}
      {saved && (
        <AppText variant="body" className="mt-3 text-primary">
          Saved {saved}&apos;s new store price.
        </AppText>
      )}

      {listing && ingredient && (
        <View className="mt-5 gap-1 rounded-2xl border border-ink-emphasis/10 p-4">
          <View className="flex-row flex-wrap items-center gap-2">
            <AppText variant="bodyBold">{listing.productTitle}</AppText>
            {!listing.inStock && (
              <AppText variant="caption" className="text-like">
                Out of stock
              </AppText>
            )}
            {bigChange && (
              <View className="rounded-full border border-notice-border bg-notice-bg px-2 py-0.5">
                <AppText variant="caption" className="text-notice-text">
                  Big change, double-check
                </AppText>
              </View>
            )}
          </View>
          <AppText variant="body">
            {peso(listing.packPrice)} per {listing.packSize} {listing.packUnit}
            {listing.regularPrice ? ` (on sale, usually ${peso(listing.regularPrice)})` : ""}
          </AppText>
          <AppText variant="body">
            {peso(Math.round(listing.pricePerUnit * 100) / 100)}/{listing.unit}
            {ratio != null && ` (${ratio >= 1 ? "+" : ""}${Math.round((ratio - 1) * 100)}% vs now)`}
          </AppText>
          {next && (
            <AppText variant="caption" className="text-ink-subtle">
              Its price becomes {peso(next.price)}/{next.unit}
              {patch?.price_source === "da" ? " (DA is still cheaper)" : patch?.estimated_price == null ? " (unchanged: a cheaper source wins)" : ""}
            </AppText>
          )}
          <View className="mt-3">
            <Button label={confirmedUpdate.isSaving ? "Saving..." : "Save store price"} disabled={confirmedUpdate.isSaving} onPress={handleSave} />
          </View>
        </View>
      )}

      <ConfirmIngredientUpdateSheet
        pending={confirmedUpdate.pending}
        affectedMeals={confirmedUpdate.affectedMeals}
        loading={confirmedUpdate.loadingAffected}
        isSaving={confirmedUpdate.isSaving}
        onConfirm={handleConfirm}
        onCancel={confirmedUpdate.cancel}
      />
    </ScrollView>
  );
}
