import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Linking, Pressable, Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { Check, CheckCircle2, ExternalLink } from "lucide-react-native";
import { AppText, Button, ErrorState, LoadingState, NoticeBanner, Spinner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import {
  commoditiesByIngredient,
  daCommodityKey,
  formatDaUnit,
  getDaCommodities,
  ingredientPricePatch,
  linkedDaPrices,
  parseDaDailyPdf,
  saveDaDailyPrices,
  type DaListedPdf,
  type DaParsedPdf,
} from "@/api/daPrices";
import { addDays } from "@/frontend/core/prices/utils/prices";
import type { IngredientRow } from "@/api/ingredients";
import { errorMessage } from "@/lib/errorMessage";
import {
  useDaCommodities,
  useDaDailyPdfs,
  useParseDaDailyPdf,
  useSaveDaDailyPrices,
  useSavedPriceDates,
} from "../hooks/useDaPrices";
import { useIngredients } from "../hooks/useIngredients";
import { useConfirmedIngredientUpdate, type PendingIngredientChange } from "../hooks/useConfirmedIngredientUpdate";
import { ConfirmIngredientUpdateSheet } from "./ConfirmIngredientUpdateSheet";
import { ActionChip, InlineError, StatTiles, StatusChip } from "./AdminUi";

const DA_PRICE_PAGE = "https://www.da.gov.ph/price-monitoring/";
// "Import last 7 days" goes back to the newest day minus this many days,
// inclusive: Price Watch compares each price with the one on or before
// that day, so it has to be saved too (Oct 9 is compared with Oct 2).
const BACKFILL_DAYS = 7;

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

// Pick a day's DA Daily Price Index → preview what was read → Save. The
// preview step is where a bad parse gets caught: nothing is written until
// Save, and ingredient prices only after the affected-meals confirmation.
export function DaImportPanel() {
  const pdfs = useDaDailyPdfs();
  const parse = useParseDaDailyPdf();
  const save = useSaveDaDailyPrices();
  const { data: commodities } = useDaCommodities();
  const { data: ingredients } = useIngredients({ showArchived: false });
  const confirmedUpdate = useConfirmedIngredientUpdate();

  const [picked, setPicked] = useState<DaListedPdf | null>(null);
  const [preview, setPreview] = useState<DaParsedPdf | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const listedDates = useMemo(() => (pdfs.data ?? []).map((p) => p.date), [pdfs.data]);
  const savedDates = useSavedPriceDates(listedDates);
  const [backfill, setBackfill] = useState<{ done: number; total: number } | null>(null);
  // The confirm sheet after a backfill only updates ingredients: the
  // prices are already saved by then.
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);

  const commodityByKey = useMemo(() => new Map((commodities ?? []).map((c) => [daCommodityKey(c), c])), [commodities]);
  const ingredientById = useMemo(() => new Map((ingredients ?? []).map((i) => [i.id, i])), [ingredients]);

  const handlePick = async (pdf: DaListedPdf) => {
    setPicked(pdf);
    setPreview(null);
    setError(null);
    setDone(null);
    try {
      setPreview(await parse.mutateAsync(pdf.url));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const priced = preview?.rows.filter((r) => r.price != null) ?? [];
  const unavailable = (preview?.rows.length ?? 0) - priced.length;
  const newCount = priced.filter((r) => !commodityByKey.has(daCommodityKey(r))).length;
  const linkedRows = priced.flatMap((r) => {
    const commodity = commodityByKey.get(daCommodityKey(r));
    const ingredient = commodity?.ingredient_id ? ingredientById.get(commodity.ingredient_id) : undefined;
    return commodity && ingredient ? [{ row: r, commodity, ingredient }] : [];
  });

  const saveAll = async () => {
    if (!preview || !picked) return;
    await save.mutateAsync({ parsed: preview, sourceUrl: picked.url });
  };

  const finish = (updated: number) => {
    setDone(
      `Saved ${priced.length} prices for ${formatDate(preview!.date)}` +
        (updated > 0 ? ` · updated ${updated} ingredient price${updated === 1 ? "" : "s"}` : ""),
    );
    setPreview(null);
    setPicked(null);
  };

  const handleSave = async () => {
    if (!preview) return;
    setError(null);
    try {
      // Linked ingredients whose price this PDF changes: each linked
      // commodity is one of their sources, and the cheapest source is their
      // price. A commodity takes this PDF's price unless a newer day is
      // already saved for it; one missing from the PDF keeps its latest.
      const newPrice = new Map<string, number>();
      for (const { row, commodity } of linkedRows) {
        if (!commodity.latest_price_date || commodity.latest_price_date <= preview.date) {
          newPrice.set(commodity.id, row.price!);
        }
      }
      const changes: PendingIngredientChange[] = [];
      for (const [ingredientId, linked] of commoditiesByIngredient(commodities ?? [])) {
        const ingredient = ingredientById.get(ingredientId);
        if (!ingredient || !linked.some((c) => newPrice.has(c.id))) continue;
        const daPrices = linked.flatMap((commodity) => {
          const price = newPrice.get(commodity.id) ?? commodity.latest_price;
          return price != null ? [{ commodity, price }] : [];
        });
        const patch = ingredientPricePatch(ingredient, daPrices);
        if (patch) changes.push({ id: ingredient.id, patch, name: ingredient.canonical_name });
      }

      if (changes.length === 0) {
        await saveAll();
        finish(0);
        return;
      }
      // Opens ConfirmIngredientUpdateSheet; the actual writes happen in
      // handleConfirm.
      await confirmedUpdate.requestUpdate(changes);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  // Saves every DA day from the last week that isn't saved yet, oldest
  // first, with no per-day preview (re-saving a day is harmless, so a bad
  // parse can be redone from its chip). Then re-prices linked ingredients
  // from the commodities' new latest prices, through the usual confirm.
  const handleBackfill = async () => {
    const all = pdfs.data ?? [];
    if (all.length === 0) return;
    setError(null);
    setDone(null);
    setPreview(null);
    setPicked(null);
    const since = addDays(all[0].date, -BACKFILL_DAYS);
    const wanted = all.filter((p) => p.date >= since);
    // DA skipped the comparison day itself: the newest older PDF stands in.
    if (!wanted.some((p) => p.date === since)) {
      const older = all.find((p) => p.date < since);
      if (older) wanted.push(older);
    }
    const missing = wanted.filter((p) => !savedDates.data?.has(p.date)).reverse();
    if (missing.length === 0) {
      setDone("The last 7 days (and the day they're compared with) are already saved.");
      return;
    }

    const imported: string[] = [];
    const failed: string[] = [];
    setBackfill({ done: 0, total: missing.length });
    for (const pdf of missing) {
      try {
        const parsed = await parseDaDailyPdf(pdf.url);
        await saveDaDailyPrices(parsed, pdf.url);
        imported.push(formatDate(pdf.date));
      } catch (err) {
        failed.push(`${formatDate(pdf.date)} (${errorMessage(err)})`);
      }
      setBackfill((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
    }
    setBackfill(null);
    queryClient.invalidateQueries({ queryKey: ["admin", "da"] });
    queryClient.invalidateQueries({ queryKey: ["prices"] });

    let message = `Imported ${imported.length} day${imported.length === 1 ? "" : "s"}`;
    if (failed.length > 0) message += `. Failed: ${failed.join(", ")}`;
    try {
      const fresh = await getDaCommodities();
      const changes: PendingIngredientChange[] = [];
      for (const [ingredientId, linked] of commoditiesByIngredient(fresh)) {
        const ingredient = ingredientById.get(ingredientId);
        const patch = ingredient ? ingredientPricePatch(ingredient, linkedDaPrices(linked)) : null;
        if (ingredient && patch) changes.push({ id: ingredient.id, patch, name: ingredient.canonical_name });
      }
      if (changes.length === 0) {
        setDone(message);
        return;
      }
      setBackfillMessage(message);
      await confirmedUpdate.requestUpdate(changes);
    } catch (err) {
      setDone(message);
      setError(errorMessage(err));
    }
  };

  const handleConfirm = async () => {
    const updated = confirmedUpdate.pending?.length ?? 0;
    if (backfillMessage) {
      try {
        await confirmedUpdate.confirm();
        setDone(`${backfillMessage} · updated ${updated} ingredient price${updated === 1 ? "" : "s"}`);
      } catch (err) {
        confirmedUpdate.cancel();
        setError(errorMessage(err));
      } finally {
        setBackfillMessage(null);
      }
      return;
    }
    try {
      await saveAll();
      await confirmedUpdate.confirm();
      finish(updated);
    } catch (err) {
      confirmedUpdate.cancel();
      setError(errorMessage(err));
    }
  };

  return (
    <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="mb-6 gap-3">
        <Text className="font-inter-regular text-body-lg text-ink">
          DA's Daily Price Index: the average retail price of ~200 commodities across 35 NCR wet markets. Pick a day
          to preview it. <Text className="font-inter-semibold">Nothing is saved until you confirm.</Text>
        </Text>
        <ActionChip
          label="DA price monitoring page"
          icon={<ExternalLink color={colors.primary} size={14} />}
          onPress={() => Linking.openURL(DA_PRICE_PAGE)}
        />
      </View>

      {done && (
        <View className="mb-5">
          <NoticeBanner tone="positive" icon={<CheckCircle2 color={colors.primary} size={18} />}>
            <AppText variant="bodyBold" className="text-primary">
              {done}
            </AppText>
          </NoticeBanner>
        </View>
      )}

      <View className="mb-3 gap-1">
        <AppText variant="sectionSubtitle" dot>
          Pick a day
        </AppText>
        <Text className="font-inter-regular text-body text-ink-subtle">
          Green with ✓ = already imported. Tap any day to preview it; saving an imported day again just overwrites it.
        </Text>
      </View>

      {pdfs.isLoading ? (
        <LoadingState label="Reading DA's list of daily PDFs. Their site can take up to 20 seconds..." />
      ) : pdfs.isError ? (
        <ErrorState message={errorMessage(pdfs.error)} onRetry={() => pdfs.refetch()} />
      ) : (
        <View className="mb-6 flex-row flex-wrap gap-2">
          <View className="mb-2 w-full">
            <Button
              label={
                backfill
                  ? `Importing ${backfill.done + 1} of ${backfill.total}...`
                  : "Import last 7 days"
              }
              variant="outline"
              disabled={!!backfill || parse.isPending || save.isPending || savedDates.isLoading}
              onPress={handleBackfill}
            />
          </View>
          {(pdfs.data ?? []).map((pdf) => {
            const active = picked?.url === pdf.url;
            // Imported = that day's prices are already in daily_prices. The
            // PDF itself is never stored, only the prices read from it.
            const imported = !!savedDates.data?.has(pdf.date);
            return (
              <Pressable
                key={pdf.url}
                onPress={() => handlePick(pdf)}
                disabled={parse.isPending || save.isPending || !!backfill}
                className={`flex-row items-center gap-1 rounded-full border px-3.5 py-2 ${
                  active ? "border-primary bg-primary" : imported ? "border-primary/40 bg-primary/5" : "border-ink-emphasis/15"
                }`}
              >
                {imported && <Check color={active ? colors.white : colors.primary} size={13} strokeWidth={2.5} />}
                <Text
                  className={`font-inter-semibold text-body ${active ? "text-white" : imported ? "text-primary" : "text-ink"}`}
                >
                  {formatDate(pdf.date)}
                  {pdf.revised ? " · Revised" : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {parse.isPending && (
        <View className="mb-4 flex-row items-center gap-2">
          <Spinner variant="wave" size={12} color={colors.accent} />
          <Text className="font-inter-medium text-body text-ink-subtle">Reading PDF...</Text>
        </View>
      )}
      {error && (
        <View className="mb-4">
          <InlineError>{error}</InlineError>
        </View>
      )}

      {preview && (
        <View className="gap-4 border-t border-ink-emphasis/10 pt-6">
          <View className="gap-3">
            <AppText variant="sectionSubtitle" dot>
              {formatDate(preview.date)}
            </AppText>
            <View className="rounded-2xl bg-primary/5 p-2">
              <StatTiles
                stats={[
                  { label: "Priced", value: String(priced.length), emphasis: true },
                  { label: "n/a (skipped)", value: String(unavailable) },
                  { label: "New", value: String(newCount) },
                  { label: "Linked", value: String(linkedRows.length) },
                ]}
              />
            </View>
          </View>

          <Button
            label={`Save ${priced.length} prices`}
            loading={save.isPending || confirmedUpdate.isSaving}
            disabled={confirmedUpdate.loadingAffected || priced.length === 0}
            onPress={handleSave}
          />

          {preview.rows.map((row, i) => {
            const key = daCommodityKey(row);
            const commodity = commodityByKey.get(key);
            const ingredient = commodity?.ingredient_id ? ingredientById.get(commodity.ingredient_id) : undefined;
            const sectionStart = i === 0 || preview.rows[i - 1].section !== row.section;
            return (
              <View key={key}>
                {sectionStart && row.section && (
                  <AppText variant="eyebrow" className="mb-1 mt-4">
                    {row.section}
                  </AppText>
                )}
                <PreviewRow
                  commodity={row.commodity}
                  specification={row.specification}
                  price={row.price}
                  unit={formatDaUnit({ unit: row.unit, unit_size: row.unitSize })}
                  isNew={row.price != null && !commodity}
                  ingredient={ingredient}
                />
              </View>
            );
          })}
        </View>
      )}

      <ConfirmIngredientUpdateSheet
        pending={confirmedUpdate.pending}
        affectedMeals={confirmedUpdate.affectedMeals}
        loading={confirmedUpdate.loadingAffected}
        isSaving={confirmedUpdate.isSaving || save.isPending}
        onConfirm={handleConfirm}
        onCancel={() => {
          confirmedUpdate.cancel();
          if (backfillMessage) setDone(`${backfillMessage} · ingredient prices not updated`);
          setBackfillMessage(null);
        }}
      />
    </ScrollView>
  );
}

function PreviewRow({
  commodity,
  specification,
  price,
  unit,
  isNew,
  ingredient,
}: {
  commodity: string;
  specification: string;
  price: number | null;
  unit: string;
  isNew: boolean;
  ingredient: IngredientRow | undefined;
}) {
  return (
    <View className="flex-row items-start gap-3 border-b border-ink-emphasis/10 py-3">
      <View className="flex-1 gap-1">
        <Text className={`font-inter-semibold text-body-lg ${price == null ? "text-ink-subtle" : "text-ink-emphasis"}`}>
          {commodity}
        </Text>
        {!!specification && <Text className="font-inter-regular text-body text-ink-subtle">{specification}</Text>}
        {ingredient && <StatusChip label={`→ ${ingredient.canonical_name}`} tone="success" icon={null} />}
        {isNew && <StatusChip label="New, not linked yet" tone="notice" icon={null} />}
      </View>
      <Text className={price == null ? "font-inter-regular text-body text-ink-subtle" : "font-inter-bold text-body-lg text-ink-emphasis"}>
        {price == null ? "n/a" : `₱${price.toFixed(2)}/${unit}`}
      </Text>
    </View>
  );
}
