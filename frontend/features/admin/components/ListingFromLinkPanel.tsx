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
import { RadioOption } from "./RadioOption";

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

// Where the price comes from: an SM link read automatically, or typed in.
type Source = "sm" | "other";

// The "other store" form's fields, as typed.
type ManualForm = {
  link: string;
  store: string;
  productTitle: string;
  price: string;
  size: string;
  unit: StoreListing["packUnit"];
};

const EMPTY_FORM: ManualForm = { link: "", store: "", productTitle: "", price: "", size: "", unit: "g" };

const toNumber = (text: string) => Number(text.replace(/[₱,\s]/g, ""));

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

// Add a store price: pick the ingredient, then choose how. "SM Markets link"
// reads the price and pack from the link; "Other store, or no link" is a
// form (price and pack size typed from the page or the market). Either way
// the same preview, then save. Saving goes through the usual
// confirm (affected meals listed and recomputed), so it's the manual
// counterpart of Ground Prices, without a paid search.
export function ListingFromLinkPanel() {
  const { data: ingredients, isLoading } = useIngredients({ showArchived: false });
  const byId = useMemo(() => new Map((ingredients ?? []).map((i) => [i.id, i])), [ingredients]);
  const [ingredientId, setIngredientId] = useState<string | null>(null);
  const ingredient = ingredientId ? byId.get(ingredientId) : undefined;

  const [source, setSource] = useState<Source>("sm");
  const [smLink, setSmLink] = useState("");
  const [form, setForm] = useState<ManualForm>(EMPTY_FORM);
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
  // Why it switched from SM to the form (informational, not an error).
  const [switchedReason, setSwitchedReason] = useState<string | null>(null);
  const confirmedUpdate = useConfirmedIngredientUpdate();

  // Linked DA prices stay among its sources, so a cheaper DA price isn't
  // overwritten by a store one.
  const { data: daCommodities } = useDaCommodities();
  const daByIngredient = useMemo(() => commoditiesByIngredient(daCommodities ?? []), [daCommodities]);
  const daOptionsFor = (row: IngredientRow): PriceOption[] =>
    linkedDaPrices(daByIngredient.get(row.id) ?? []).flatMap(({ commodity, price }) => daPriceOption(commodity, price, row) ?? []);

  const reset = () => {
    setSmLink("");
    setForm(EMPTY_FORM);
    setListing(null);
    setError(null);
    setSwitchedReason(null);
  };

  const chooseSource = (next: Source) => {
    setSource(next);
    setListing(null);
    setError(null);
    setSwitchedReason(null);
  };

  // Any field edited: the preview no longer matches it.
  const editForm = (change: Partial<ManualForm>) => {
    setForm((prev) => ({ ...prev, ...change }));
    setListing(null);
  };

  const formValid = !!form.store.trim() && !!form.productTitle.trim() && toNumber(form.price) > 0 && toNumber(form.size) > 0;

  const handleFormPreview = () => {
    if (!ingredient || !formValid) return;
    setListing(
      manualListing(
        {
          url: form.link,
          store: form.store,
          productTitle: form.productTitle,
          packPrice: toNumber(form.price),
          packSize: toNumber(form.size),
          packUnit: form.unit,
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
      setListing(await fetchListingFromUrl(smLink, ingredient));
    } catch (err) {
      if (err instanceof ListingNeedsInput) {
        // Not an SM link, or one SM can't fully describe: over to the form,
        // filled in with what's known.
        const { partial } = err;
        setForm({
          ...EMPTY_FORM,
          link: partial.url ?? smLink,
          store: partial.store ?? storeFromUrl(smLink),
          productTitle: partial.productTitle ?? "",
          price: partial.packPrice ? String(partial.packPrice) : "",
        });
        setSource("other");
        setSwitchedReason(err.message);
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
        Add a real store price to an ingredient. It takes the cheapest of its real prices, and its AI pack estimate is
        removed. Nothing is saved until you confirm.
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
          <AppText variant="bodyBold">How are you adding it?</AppText>
          <RadioOption
            selected={source === "sm"}
            label="SM Markets link"
            description="Paste the product link; the price and pack size are read for you."
            onPress={() => chooseSource("sm")}
          />
          <RadioOption
            selected={source === "other"}
            label="Other store, or no link"
            description="Any other store, or a market price: type the price and pack size."
            onPress={() => chooseSource("other")}
          />

          {source === "sm" ? (
            <View className="mt-2 gap-3">
              <TextField
                label="SM Markets link"
                value={smLink}
                onChangeText={(text) => {
                  setSmLink(text);
                  setListing(null);
                  setError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Button label="Get price" loading={fetching} disabled={!smLink.trim() || fetching} onPress={handleFetch} />
            </View>
          ) : (
            <View className="mt-2 gap-3">
              {switchedReason && (
                <AppText variant="caption" className="text-ink-subtle">
                  {switchedReason}
                </AppText>
              )}
              <TextField
                label="Link (optional)"
                value={form.link}
                onChangeText={(link) =>
                  // A pasted link fills in the store, unless one's typed.
                  editForm({ link, ...(form.store.trim() ? {} : { store: storeFromUrl(link) }) })
                }
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <TextField label="Store" value={form.store} onChangeText={(store) => editForm({ store })} />
              <TextField
                label="Product (as on the page)"
                value={form.productTitle}
                onChangeText={(productTitle) => editForm({ productTitle })}
              />
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <TextField label="Price" value={form.price} onChangeText={(price) => editForm({ price })} keyboardType="decimal-pad" />
                </View>
                <View className="flex-1">
                  <TextField
                    label="Pack size"
                    value={form.size}
                    onChangeText={(size) => editForm({ size })}
                    keyboardType="decimal-pad"
                    suffix={form.unit}
                  />
                </View>
              </View>
              <SegmentedSwitch options={PACK_UNITS} value={form.unit} onChange={(unit) => editForm({ unit })} />
              <Button label="Preview" disabled={!formValid} onPress={handleFormPreview} />
            </View>
          )}
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
