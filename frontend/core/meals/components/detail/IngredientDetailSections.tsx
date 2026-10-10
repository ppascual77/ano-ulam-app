import { ReactNode } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { ChartColumn, Database, ExternalLink, Minus, ShoppingCart, Store, TrendingDown, TrendingUp } from "lucide-react-native";
import { Card, Chips } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { getUsdaSourceUrl } from "@/api/ingredients";
import { useDaWeekChanges, type DaWeekChange } from "@/frontend/core/prices/hooks/useDaWeekChanges";
import type { DaPriceSourceType, IngredientType, PriceSourceType } from "../../mealTypes";
import { MicronutrientList, hasMicronutrients } from "./MicronutrientList";

// The three sections of IngredientDetailSheet: what this amount contains,
// where that nutrition data comes from, and where the price comes from.

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <View className="mt-7">
      <Text className="font-inter-bold text-subheading text-ink-emphasis">{title}</Text>
      {description && <Text className="mt-1 font-inter-regular text-body text-ink-subtle">{description}</Text>}
      <View className="mt-3">{children}</View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Nutrition in this amount
// ---------------------------------------------------------------------------

// One tile: a colored dot, the value big, the label small under it.
function MacroTile({ color, value, label }: { color: string; value: string; label: string }) {
  return (
    <View className="flex-1 rounded-2xl border border-web-divider bg-web-divider/40 px-3 py-3">
      <View className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
      <Text className="mt-3 font-inter-extrabold text-subheading text-ink-emphasis" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text className="font-inter-regular text-small text-ink-subtle">{label}</Text>
    </View>
  );
}

type NutritionItem = Pick<IngredientType, "calories" | "protein" | "fats" | "carbs" | "calculationError" | "note">;

export function hasNutrition(item: NutritionItem) {
  return item.calories != null || !!item.calculationError || !!item.note;
}

export function NutritionSection({ item }: { item: NutritionItem }) {
  if (!hasNutrition(item)) return null;

  return (
    <Section
      title="Nutrition in this amount"
      description="What this ingredient adds to your meal at the quantity used."
    >
      {item.calories != null ? (
        <View className="flex-row gap-2">
          {/* Same per-macro colors as the rest of the app (MacroBreakdown),
              with accent orange for calories. */}
          <MacroTile color={colors.accent} value={`${Math.round(item.calories)}`} label="kcal" />
          <MacroTile color={colors.macro.protein} value={`${(item.protein ?? 0).toFixed(1)}g`} label="Protein" />
          <MacroTile color={colors.macro.fats} value={`${(item.fats ?? 0).toFixed(1)}g`} label="Fat" />
          <MacroTile color={colors.macro.carbs} value={`${(item.carbs ?? 0).toFixed(1)}g`} label="Carbs" />
        </View>
      ) : (
        item.calculationError && (
          <Text className="font-inter-medium text-body text-like">Can't calculate: {item.calculationError}</Text>
        )
      )}
      {/* For every viewer, not an admin-only diagnostic — explains why the
          counted amount differs from the quantity shown above it (e.g.
          "1 cup" used for frying, but only a fraction gets absorbed). */}
      {item.note && <Text className="mt-3 font-inter-regular text-small text-ink-subtle">{item.note}</Text>}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Micronutrients
// ---------------------------------------------------------------------------

export function MicronutrientSection({ item }: { item: Pick<IngredientType, "fiber" | "sugar" | "sodium"> }) {
  if (!hasMicronutrients(item)) return null;
  return (
    <Section title="Micronutrients" description="Share of a day's recommended amount, based on a 2,000-calorie diet.">
      <View className="rounded-2xl border border-web-divider bg-web-divider/40 p-4">
        <MicronutrientList values={item} />
      </View>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Nutrition source
// ---------------------------------------------------------------------------

// Amber box for anything still estimated (nutrition or price), so "not yet
// verified" reads the same in both source sections.
function EstimateBox({ title, description }: { title: string; description: string }) {
  return (
    <View className="rounded-2xl border border-notice-border bg-notice-bg px-4 py-3">
      <View className="flex-row items-center gap-2">
        <View className="rounded bg-accent/10 px-1.5 py-0.5">
          <Text className="font-inter-semibold text-small text-accent">ESTIMATE</Text>
        </View>
        <Text className="font-inter-bold text-body text-ink-emphasis">{title}</Text>
      </View>
      <Text className="mt-2 font-inter-regular text-body text-ink-subtle">{description}</Text>
    </View>
  );
}

export function NutritionSourceSection({
  item,
}: {
  item: Pick<IngredientType, "source" | "sourceRefId" | "sourceDescription">;
}) {
  return (
    <Section title="Nutrition source">
      {item.source === "USDA" ? (
        <SourceCard
          icon={<Database color={colors.ink.emphasis} size={20} />}
          title="USDA FoodData Central"
          lines={[item.sourceDescription ?? "—", ...(item.sourceRefId ? [`FDC ID ${item.sourceRefId}`] : [])]}
          url={item.sourceRefId ? getUsdaSourceUrl(item.sourceRefId) : undefined}
        />
      ) : item.source === "FNRI" ? (
        <SourceCard
          icon={<Database color={colors.ink.emphasis} size={20} />}
          title="FNRI Philippine Food Composition Tables"
          lines={item.sourceDescription ? [item.sourceDescription] : []}
        />
      ) : (
        <EstimateBox title="Estimated values" description="Not yet matched to a USDA or FNRI food record." />
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Price source
// ---------------------------------------------------------------------------

function formatPack(source: PriceSourceType) {
  const unit = source.packUnit === "piece" ? " pc" : source.packUnit;
  return `₱${source.packPrice} / ${source.packSize}${unit}`;
}

function formatPerUnit(price: number, unit: string) {
  return `₱${Math.round(price)}/${unit}`;
}

function IconCircle({ children }: { children: ReactNode }) {
  return <View className="h-11 w-11 items-center justify-center rounded-full bg-ink-emphasis/5">{children}</View>;
}

// Shared by both source sections, so "where did this number come from"
// reads the same for nutrition and price: icon, source name, details,
// and (when there's a link) an external-link icon with the whole card
// tappable. `trailing` is the price column for price sources.
function SourceCard({
  icon,
  title,
  lines,
  url,
  trailing,
  extra,
  highlighted = false,
}: {
  icon: ReactNode;
  title: string;
  lines: string[];
  url?: string;
  trailing?: ReactNode;
  /** Under the lines (e.g. a DA price's change vs last week). */
  extra?: ReactNode;
  highlighted?: boolean;
}) {
  const card = (
    <Card variant={highlighted ? "highlighted" : "outlined"}>
      <View className="flex-row items-center gap-3">
        <IconCircle>{icon}</IconCircle>

        <View className="flex-1 gap-1">
          <Text className="font-inter-semibold text-body text-ink-emphasis" numberOfLines={1}>
            {title}
          </Text>
          {lines.map((line, i) => (
            <Text key={i} className="font-inter-regular text-body text-ink-subtle" numberOfLines={2}>
              {line}
            </Text>
          ))}
          {extra}
        </View>

        {trailing}
        {url && <ExternalLink color={colors.ink.emphasis} size={18} />}
      </View>
    </Card>
  );

  return url ? <Pressable onPress={() => Linking.openURL(url)}>{card}</Pressable> : card;
}

const DA_PRICE_PAGE = "https://www.da.gov.ph/price-monitoring/";

function PriceTrailing({ price, unit, isBest }: { price: number; unit: string; isBest: boolean }) {
  return (
    <View className="items-end gap-2">
      {isBest && <Chips variant="soft" label="Best price" />}
      <Text className="font-inter-bold text-subheading text-primary">{formatPerUnit(price, unit)}</Text>
    </View>
  );
}

// One store listing. The cheapest source is highlighted with a "Best price"
// chip when there's more than one.
function PriceSourceCard({ source, isBest }: { source: PriceSourceType; isBest: boolean }) {
  return (
    <SourceCard
      icon={<ShoppingCart color={colors.ink.emphasis} size={20} />}
      title={source.store}
      lines={[source.productTitle, formatPack(source)]}
      url={source.url}
      highlighted={isBest}
      trailing={<PriceTrailing price={source.pricePerUnit} unit={source.unit} isBest={isBest} />}
    />
  );
}

const TREND_TEXT_CLASS = { down: "text-trend-down", up: "text-trend-up", flat: "text-trend-flat" } as const;

// "Last week ₱286/kg ↘ −1.0%": last week's DA price in the card's own unit
// (scaled by the same ratio as the raw DA prices) and the % change.
function DaWeekChangeLine({ change, pricePerUnit, unit }: { change: DaWeekChange; pricePerUnit: number; unit: string }) {
  const pct = change.pctChange;
  const trend = pct < 0 ? "down" : pct > 0 ? "up" : "flat";
  const Icon = trend === "down" ? TrendingDown : trend === "up" ? TrendingUp : Minus;
  const lastWeek = (pricePerUnit * change.weekAgoPrice) / change.latestPrice;
  return (
    <View className="flex-row flex-wrap items-center gap-x-2">
      <Text className="font-inter-regular text-small text-ink-subtle">Last week {formatPerUnit(lastWeek, unit)}</Text>
      <View className="flex-row items-center gap-0.5">
        <Icon color={colors.trend[trend]} size={12} strokeWidth={2.5} />
        <Text className={`font-inter-bold text-small ${TREND_TEXT_CLASS[trend]}`}>
          {pct > 0 ? "+" : ""}
          {pct}%
        </Text>
      </View>
    </View>
  );
}

// One DA Daily Price Index price: the average across NCR wet markets, with
// its change vs last week when DA has a price that old.
function DaPriceSourceCard({ source, isBest, change }: { source: DaPriceSourceType; isBest: boolean; change?: DaWeekChange }) {
  const date = new Date(`${source.date}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  return (
    <SourceCard
      icon={<Store color={colors.ink.emphasis} size={20} />}
      title="DA Bantay Presyo"
      lines={[
        source.specification ? `${source.commodity} · ${source.specification}` : source.commodity,
        `Metro Manila wet markets · ${date}`,
      ]}
      url={DA_PRICE_PAGE}
      highlighted={isBest}
      extra={change && <DaWeekChangeLine change={change} pricePerUnit={source.pricePerUnit} unit={source.unit} />}
      trailing={<PriceTrailing price={source.pricePerUnit} unit={source.unit} isBest={isBest} />}
    />
  );
}

export function PriceSourceSection({ item }: { item: Pick<IngredientType, "priceSources" | "daPriceSources"> }) {
  const sources = item.priceSources ?? [];
  const da = item.daPriceSources ?? [];
  const weekChanges = useDaWeekChanges(da.flatMap((d) => (d.commodityId ? [d.commodityId] : [])));
  const prices = [...da.map((d) => d.pricePerUnit), ...sources.map((s) => s.pricePerUnit)];

  if (prices.length === 0) {
    return (
      <Section title="Price source">
        <EstimateBox title="Estimated price" description="Not yet checked against a market or supermarket price." />
      </Section>
    );
  }

  // The cheapest source is the ingredient's stored price (cheapestPriceOption
  // in api/ingredients.ts). Every source is normalized to ₱/kg or ₱/L.
  const cheapest = Math.min(...prices);
  const average = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const unit = da[0]?.unit ?? sources[0].unit;
  const showBest = prices.length > 1;

  return (
    <Section title="Price source" description="Prices are per standard market unit. Your actual cost may vary.">
      <View className="gap-3">
        {da.map((d) => (
          <DaPriceSourceCard
            key={`${d.commodity}|${d.specification}`}
            source={d}
            isBest={showBest && d.pricePerUnit === cheapest}
            change={d.commodityId ? weekChanges.data?.get(d.commodityId) : undefined}
          />
        ))}
        {sources.map((source) => (
          <PriceSourceCard key={source.url} source={source} isBest={showBest && source.pricePerUnit === cheapest} />
        ))}
      </View>

      {prices.length > 1 && (
        <>
          <View className="my-4 h-px bg-ink-emphasis/10" />
          <View className="flex-row items-center gap-3 rounded-2xl bg-primary/5 px-4 py-4">
            <IconCircle>
              <ChartColumn color={colors.primary} size={20} />
            </IconCircle>
            <View className="flex-1">
              <Text className="font-inter-semibold text-body text-ink-emphasis">Average price</Text>
              <Text className="font-inter-regular text-small text-ink-subtle">Based on available sources</Text>
            </View>
            <Text className="font-inter-bold text-subheading text-primary">{formatPerUnit(average, unit)}</Text>
          </View>
        </>
      )}
    </Section>
  );
}
