import { useMemo, useState } from "react";
import { View, Pressable, Linking } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { ExternalLink } from "lucide-react-native";
import { AppText, Button, ErrorState, LoadingState } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import {
  commoditiesByIngredient,
  daCommodityKey,
  formatDaUnit,
  ingredientPricePatch,
  type DaListedPdf,
  type DaParsedPdf,
} from "@/api/daPrices";
import type { IngredientRow } from "@/api/ingredients";
import { errorMessage } from "@/lib/errorMessage";
import { useDaCommodities, useDaDailyPdfs, useParseDaDailyPdf, useSaveDaDailyPrices } from "../hooks/useDaPrices";
import { useIngredients } from "../hooks/useIngredients";
import { useConfirmedIngredientUpdate, type PendingIngredientChange } from "../hooks/useConfirmedIngredientUpdate";
import { ConfirmIngredientUpdateSheet } from "./ConfirmIngredientUpdateSheet";

const DA_PRICE_PAGE = "https://www.da.gov.ph/price-monitoring/";

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

  const handleConfirm = async () => {
    const updated = confirmedUpdate.pending?.length ?? 0;
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
      <AppText variant="body" className="text-ink-subtle mb-1">
        DA's Daily Price Index: the average retail price of ~200 commodities across 35 NCR wet markets. Pick a day
        to preview it. Nothing is saved until you confirm.
      </AppText>
      <Pressable onPress={() => Linking.openURL(DA_PRICE_PAGE)} className="flex-row items-center gap-1 mb-4">
        <AppText variant="caption" className="text-primary">
          DA price monitoring page
        </AppText>
        <ExternalLink color={colors.primary} size={12} />
      </Pressable>

      {done && (
        <AppText variant="bodyBold" className="text-primary mb-4">
          {done}
        </AppText>
      )}

      {pdfs.isLoading ? (
        <LoadingState />
      ) : pdfs.isError ? (
        <ErrorState />
      ) : (
        <View className="flex-row flex-wrap gap-2 mb-4">
          {(pdfs.data ?? []).map((pdf) => {
            const active = picked?.url === pdf.url;
            return (
              <Pressable
                key={pdf.url}
                onPress={() => handlePick(pdf)}
                disabled={parse.isPending || save.isPending}
                className={`rounded-full border px-3 py-2 ${active ? "border-primary bg-primary/10" : "border-ink-emphasis/10"}`}
              >
                <AppText variant="caption" className={active ? "text-primary" : "text-ink"}>
                  {formatDate(pdf.date)}
                  {pdf.revised ? " · Revised" : ""}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      )}

      {parse.isPending && (
        <AppText variant="caption" className="text-ink-subtle">
          Reading PDF...
        </AppText>
      )}
      {error && (
        <AppText variant="body" className="text-like mb-3">
          {error}
        </AppText>
      )}

      {preview && (
        <View className="gap-3">
          <View>
            <AppText variant="title">{formatDate(preview.date)}</AppText>
            <AppText variant="caption" className="text-ink-subtle">
              {priced.length} priced · {unavailable} n/a (skipped) · {newCount} new commodit
              {newCount === 1 ? "y" : "ies"} · {linkedRows.length} linked to ingredients
            </AppText>
          </View>

          <Button
            label={save.isPending || confirmedUpdate.isSaving ? "Saving..." : `Save ${priced.length} prices`}
            disabled={save.isPending || confirmedUpdate.isSaving || confirmedUpdate.loadingAffected || priced.length === 0}
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
                  <AppText variant="eyebrow" className="mt-3 mb-1">
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
        onCancel={confirmedUpdate.cancel}
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
    <View className="flex-row items-start gap-3 border-b border-ink-emphasis/10 py-2">
      <View className="flex-1">
        <AppText variant="bodyMedium" className={price == null ? "text-ink-subtle" : ""}>
          {commodity}
        </AppText>
        {!!specification && (
          <AppText variant="caption" className="text-ink-subtle">
            {specification}
          </AppText>
        )}
        {ingredient && (
          <AppText variant="caption" className="text-primary">
            → {ingredient.canonical_name}
          </AppText>
        )}
        {isNew && (
          <AppText variant="caption" className="text-accent">
            New, not linked yet
          </AppText>
        )}
      </View>
      <AppText variant={price == null ? "caption" : "bodyBold"}>
        {price == null ? "n/a" : `₱${price.toFixed(2)}/${unit}`}
      </AppText>
    </View>
  );
}
