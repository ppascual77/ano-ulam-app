import { ReactNode } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { ArrowUpRight, Database, Info, Minus, ShoppingCart, Sparkles, Store, TrendingDown, TrendingUp } from "lucide-react-native";
import { AppText, Card, Chips } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { getUsdaSourceUrl } from "@/api/ingredients";
import { useDaWeekChanges, type DaWeekChange } from "@/frontend/core/prices/hooks/useDaWeekChanges";
import type { DaPriceSourceType, IngredientType, PackEstimateType, PriceSourceType } from "../../mealTypes";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";
import { LockedMicronutrients, MicronutrientList, hasMicronutrients } from "./MicronutrientList";
import { GrowFill } from "./GrowFill";
import { MACRO_GROW_DELAY, MICRO_GROW_DELAY, riseIn, useCountUp } from "./sheetMotion";

// The sections of IngredientDetailSheet: what this amount contains, its
// micronutrients, and where the nutrition and price numbers come from.
// Every section is one outlined card made of full-width rows split by
// hairlines, so the sheet reads as one surface.

/** A titled block that fades up as the sheet opens (`index` sets its place
 *  in the stagger). `aside`: a short note right of the title. `footnote`:
 *  small print under the card. */
function SheetSection({
  title,
  aside,
  footnote,
  index,
  children,
}: {
  title: string;
  aside?: string;
  footnote?: string;
  index: number;
  children: ReactNode;
}) {
  return (
    <Animated.View entering={riseIn(index)}>
      <View className="mt-7">
        <View className="flex-row items-baseline justify-between gap-3">
          <AppText variant="sheetSection" dot>
            {title}
          </AppText>
          {aside && (
            <Text className="flex-shrink text-right font-inter-regular text-small text-ink-subtle" numberOfLines={1}>
              {aside}
            </Text>
          )}
        </View>
        <Card variant="outlined" padded={false} className="mt-3">
          {children}
        </Card>
        {footnote && <Text className="mt-2.5 font-inter-regular text-small text-ink-subtle">{footnote}</Text>}
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Nutrition in this amount
// ---------------------------------------------------------------------------

type NutritionItem = Pick<IngredientType, "qty" | "calories" | "protein" | "fats" | "carbs" | "calculationError" | "note">;

export function hasNutrition(item: Omit<NutritionItem, "qty">) {
  return item.calories != null || !!item.calculationError || !!item.note;
}

// Same per-macro colors as the meal's donut (MacroSection).
const MACROS = [
  { key: "protein", label: "Protein", color: colors.macro.protein, kcalPerGram: 4 },
  { key: "fats", label: "Fat", color: colors.macro.fats, kcalPerGram: 9 },
  { key: "carbs", label: "Carbs", color: colors.macro.carbs, kcalPerGram: 4 },
] as const;

function Kcal({ calories }: { calories: number }) {
  const shown = useCountUp(calories, MACRO_GROW_DELAY, 560);
  return (
    <View className="flex-row items-baseline gap-1.5">
      <Text className="font-inter-extrabold text-heading tracking-display text-ink-emphasis">{shown}</Text>
      <Text className="font-inter-regular text-body text-ink-subtle">kcal</Text>
    </View>
  );
}

export function NutritionSection({ item }: { item: NutritionItem }) {
  if (!hasNutrition(item)) return null;

  const grams = { protein: item.protein ?? 0, fats: item.fats ?? 0, carbs: item.carbs ?? 0 };
  const macroKcal = MACROS.map((m) => grams[m.key] * m.kcalPerGram);
  const totalKcal = macroKcal.reduce((sum, k) => sum + k, 0);
  const shares = macroKcal.map((k) => (totalKcal > 0 ? k / totalKcal : 0));

  return (
    <SheetSection title="Nutrition" aside={`for ${item.qty}`} index={1}>
      {item.calories != null ? (
        <View className="p-4">
          <Kcal calories={item.calories} />

          {/* Where those calories come from: one segment per macro, sized
              by its share, each growing in 80ms after the last. */}
          {totalKcal > 0 && (
            <View
              className="mt-3 h-2 flex-row gap-0.5"
              accessibilityLabel={`Calories by macro: ${MACROS.map((m, i) => `${m.label} ${Math.round(shares[i] * 100)}%`).join(", ")}`}
            >
              {MACROS.map((m, i) =>
                shares[i] > 0 ? (
                  <View key={m.key} className="h-full overflow-hidden rounded-full" style={{ flex: shares[i] }}>
                    <GrowFill
                      percent={100}
                      delay={MACRO_GROW_DELAY + i * 80}
                      duration={560}
                      style={{ height: "100%", backgroundColor: m.color }}
                    />
                  </View>
                ) : null,
              )}
            </View>
          )}

          <View className="mt-4 flex-row">
            {MACROS.map((m, i) => (
              <View key={m.key} className={`flex-1 ${i > 0 ? "border-l border-ink-emphasis/10 pl-3" : ""} pr-3`}>
                <View className="flex-row items-center gap-1.5">
                  <View className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                  <Text className="font-inter-regular text-small text-ink-subtle">{m.label}</Text>
                </View>
                <Text className="mt-1 font-inter-extrabold text-subheading text-ink-emphasis" numberOfLines={1} adjustsFontSizeToFit>
                  {grams[m.key].toFixed(1)}
                  <Text className="font-inter-semibold text-body text-ink-subtle">g</Text>
                </Text>
                {totalKcal > 0 && (
                  <Text className="mt-1 font-inter-semibold text-sub text-ink-subtle">{Math.round(shares[i] * 100)}% of kcal</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      ) : (
        item.calculationError && (
          <Text className="p-4 font-inter-medium text-body text-like">Can't calculate: {item.calculationError}</Text>
        )
      )}

      {/* For every viewer, not an admin-only diagnostic: explains why the
          counted amount differs from the quantity shown (e.g. "1 cup" used
          for frying, but only a fraction gets absorbed). */}
      {item.note && (
        <View className="flex-row gap-2 border-t border-ink-emphasis/5 bg-web-divider/40 px-4 py-3">
          <View className="pt-0.5">
            <Info color={colors.ink.subtle} size={16} />
          </View>
          <Text className="flex-1 font-inter-regular text-small text-ink-subtle">{item.note}</Text>
        </View>
      )}
    </SheetSection>
  );
}

// ---------------------------------------------------------------------------
// Micronutrients
// ---------------------------------------------------------------------------

// Pro: free users get LockedMicronutrients (`onLockedPro` opens the upsell).
export function MicronutrientSection({ item, onLockedPro }: { item: Pick<IngredientType, "fiber" | "sugar" | "sodium">; onLockedPro?: () => void }) {
  const isPro = useIsPro();
  if (!hasMicronutrients(item)) return null;
  return (
    <SheetSection
      title="Micronutrients"
      aside="% of daily value"
      footnote={`Based on a 2,000-calorie diet.${item.sugar != null ? " Sugar is measured against the 50g daily limit." : ""}`}
      index={2}
    >
      {isPro ? (
        <MicronutrientList values={item} compact growDelay={MICRO_GROW_DELAY} />
      ) : (
        <LockedMicronutrients values={item} onUnlock={onLockedPro} compact />
      )}
    </SheetSection>
  );
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

function formatPack(source: PriceSourceType) {
  const unit = source.packUnit === "piece" ? " pc" : source.packUnit;
  return `₱${source.packPrice} / ${source.packSize}${unit}`;
}

function formatPerUnit(price: number, unit: string) {
  return `₱${Math.round(price)}/${unit}`;
}

/** A small uppercase label over a group of rows ("Nutrition", "Price per kg"). */
function GroupLabel({ children, first }: { children: string; first?: boolean }) {
  return (
    <Text className={`px-4 ${first ? "pt-3" : "border-t border-ink-emphasis/5 pt-4"} font-inter-semibold text-sub uppercase tracking-widest text-ink-subtle`}>
      {children}
    </Text>
  );
}

function EstimateTag() {
  return (
    <View className="rounded bg-accent/10 px-1.5 py-0.5">
      <Text className="font-inter-bold text-sub tracking-wide text-accent">ESTIMATE</Text>
    </View>
  );
}

const ICON_SIZE = 18;
const estimateIcon = <Sparkles color={colors.notice.icon} size={ICON_SIZE} />;

// One source: icon tile, name, details, an optional price, and (when it
// links out) an arrow. The whole row is the tap target. `divided`: a
// hairline above, for every row after a group's first. `estimate`: an
// amber tile and an ESTIMATE tag, for anything not yet verified.
function SourceRow({
  icon,
  title,
  subtitle,
  extra,
  trailing,
  url,
  estimate = false,
  divided = false,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  extra?: ReactNode;
  trailing?: ReactNode;
  url?: string;
  estimate?: boolean;
  divided?: boolean;
}) {
  const content = (
    <>
      <View
        className={`h-9 w-9 items-center justify-center rounded-xl ${estimate ? "border border-notice-border bg-notice-bg" : "bg-ink-emphasis/5"}`}
      >
        {icon}
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <Text className="flex-shrink font-inter-semibold text-body text-ink-emphasis" numberOfLines={estimate ? 2 : 1}>
            {title}
          </Text>
          {estimate && <EstimateTag />}
        </View>
        {subtitle && (
          <Text className="font-inter-regular text-small text-ink-subtle" numberOfLines={2}>
            {subtitle}
          </Text>
        )}
        {extra}
      </View>
      {trailing}
      {/* On every row that links out (prices too), so it's clear the row
          opens the source. */}
      {url && <ArrowUpRight color={colors.ink.subtle} size={16} />}
    </>
  );

  const rowClass = `flex-row items-center gap-3 px-4 py-3 ${divided ? "border-t border-ink-emphasis/5" : ""}`;
  return url ? (
    <Pressable accessibilityRole="link" onPress={() => Linking.openURL(url)} className={`${rowClass} active:bg-primary/5`}>
      {content}
    </Pressable>
  ) : (
    <View className={rowClass}>{content}</View>
  );
}

// ---- Nutrition rows --------------------------------------------------------

function NutritionSourceRow({ item }: { item: Pick<IngredientType, "source" | "sourceRefId" | "sourceDescription"> }) {
  const icon = <Database color={colors.ink.emphasis} size={ICON_SIZE} />;
  if (item.source === "USDA") {
    const details = [item.sourceDescription, item.sourceRefId ? `FDC ${item.sourceRefId}` : null].filter(Boolean).join(" · ");
    return (
      <SourceRow
        icon={icon}
        title="USDA FoodData Central"
        subtitle={details || undefined}
        url={item.sourceRefId ? getUsdaSourceUrl(item.sourceRefId) : undefined}
      />
    );
  }
  if (item.source === "FNRI") {
    return <SourceRow icon={icon} title="FNRI Philippine Food Composition Tables" subtitle={item.sourceDescription ?? undefined} />;
  }
  return <SourceRow icon={estimateIcon} title="Estimated values" subtitle="Not yet matched to a USDA or FNRI food record" estimate />;
}

// ---- Price rows ------------------------------------------------------------

/** The ₱ per kg/L figure, green with a "Best" chip for the cheapest. The
 *  unit is in the group label, so only the peso amount shows here. */
function PriceTrailing({ price, isBest, highlight }: { price: number; isBest: boolean; highlight: boolean }) {
  return (
    <View className="items-end gap-1">
      {isBest && <Chips label="Best" />}
      <Text className={`font-inter-extrabold text-subheading ${highlight ? "text-primary" : "text-ink-emphasis"}`}>₱{Math.round(price)}</Text>
    </View>
  );
}

const DA_PRICE_PAGE = "https://www.da.gov.ph/price-monitoring/";

const TREND_TEXT_CLASS = { down: "text-trend-down", up: "text-trend-up", flat: "text-trend-flat" } as const;

// "↘ 7% vs ₱86 last week": the change and last week's DA price in the row's
// own unit (scaled by the same ratio as the raw DA prices).
function DaWeekChangeLine({ change, pricePerUnit }: { change: DaWeekChange; pricePerUnit: number }) {
  const pct = change.pctChange;
  const trend = pct < 0 ? "down" : pct > 0 ? "up" : "flat";
  const Icon = trend === "down" ? TrendingDown : trend === "up" ? TrendingUp : Minus;
  const lastWeek = (pricePerUnit * change.weekAgoPrice) / change.latestPrice;
  return (
    <View className="mt-0.5 flex-row flex-wrap items-center gap-1">
      <Icon color={colors.trend[trend]} size={12} strokeWidth={2.5} />
      {trend !== "flat" && <Text className={`font-inter-bold text-small ${TREND_TEXT_CLASS[trend]}`}>{Math.abs(pct)}%</Text>}
      <Text className="font-inter-regular text-small text-ink-subtle">
        {trend === "flat" ? `Same as last week, ₱${Math.round(lastWeek)}` : `vs ₱${Math.round(lastWeek)} last week`}
      </Text>
    </View>
  );
}

function daDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

function PackEstimateRow({ estimate, divided }: { estimate: PackEstimateType; divided?: boolean }) {
  return (
    <SourceRow
      icon={estimateIcon}
      title={`Typically ~₱${Math.round(estimate.price)} per ${estimate.size} ${estimate.container}`}
      subtitle="Typical retail pack"
      estimate
      divided={divided}
    />
  );
}

type SourcesItem = Pick<
  IngredientType,
  "source" | "sourceRefId" | "sourceDescription" | "priceSources" | "daPriceSources" | "packEstimate" | "calories" | "calculationError" | "note"
>;

/** Where the numbers come from: the nutrition record (when there's
 *  nutrition to source) and every price source, as labelled groups in one
 *  card, with the average as its footer row. */
export function SourcesSection({ item }: { item: SourcesItem }) {
  const sources = item.priceSources ?? [];
  const da = item.daPriceSources ?? [];
  const weekChanges = useDaWeekChanges(da.flatMap((d) => (d.commodityId ? [d.commodityId] : [])));
  const prices = [...da.map((d) => d.pricePerUnit), ...sources.map((s) => s.pricePerUnit)];
  // Real store listings always win over the estimate.
  const packEstimate = sources.length === 0 ? item.packEstimate : undefined;
  const showNutrition = hasNutrition(item);

  // The cheapest source is the ingredient's stored price (cheapestPriceOption
  // in api/ingredients.ts). Every source is normalized to ₱/kg or ₱/L.
  const cheapest = prices.length > 0 ? Math.min(...prices) : 0;
  const average = prices.reduce((sum, p) => sum + p, 0) / (prices.length || 1);
  const unit = da[0]?.unit ?? sources[0]?.unit;
  const compare = prices.length > 1;
  const hasLink = (showNutrition && item.source === "USDA" && !!item.sourceRefId) || da.length > 0 || sources.some((s) => !!s.url);
  let priceRow = 0;

  return (
    <SheetSection
      title="Sources"
      aside={hasLink ? "Tap to view" : undefined}
      footnote={prices.length > 0 ? "Prices are per standard market unit. Your actual cost may vary." : undefined}
      index={3}
    >
      {showNutrition && (
        <>
          <GroupLabel first>Nutrition</GroupLabel>
          <NutritionSourceRow item={item} />
        </>
      )}

      <GroupLabel first={!showNutrition}>{unit ? `Price per ${unit}` : "Price"}</GroupLabel>
      {prices.length === 0 ? (
        packEstimate ? (
          <PackEstimateRow estimate={packEstimate} />
        ) : (
          <SourceRow icon={estimateIcon} title="Estimated price" subtitle="Not yet checked against a market or supermarket price" estimate />
        )
      ) : (
        <>
          {da.map((d) => {
            const isBest = compare && d.pricePerUnit === cheapest;
            const change = d.commodityId ? weekChanges.data?.get(d.commodityId) : undefined;
            const commodity = d.specification ? `${d.commodity}, ${d.specification}` : d.commodity;
            return (
              <SourceRow
                key={`${d.commodity}|${d.specification}`}
                divided={priceRow++ > 0}
                icon={<Store color={colors.ink.emphasis} size={ICON_SIZE} />}
                title="Dept. of Agriculture"
                subtitle={`${commodity} · Metro Manila wet markets, ${daDate(d.date)}`}
                extra={change && <DaWeekChangeLine change={change} pricePerUnit={d.pricePerUnit} />}
                url={DA_PRICE_PAGE}
                trailing={<PriceTrailing price={d.pricePerUnit} isBest={isBest} highlight={isBest || !compare} />}
              />
            );
          })}
          {sources.map((s) => {
            const isBest = compare && s.pricePerUnit === cheapest;
            return (
              <SourceRow
                key={`${s.store}|${s.productTitle}|${s.url}`}
                divided={priceRow++ > 0}
                icon={<ShoppingCart color={colors.ink.emphasis} size={ICON_SIZE} />}
                title={s.store}
                subtitle={`${s.productTitle} · ${formatPack(s)}`}
                url={s.url}
                trailing={<PriceTrailing price={s.pricePerUnit} isBest={isBest} highlight={isBest || !compare} />}
              />
            );
          })}
          {packEstimate && <PackEstimateRow estimate={packEstimate} divided />}
        </>
      )}

      {compare && unit && (
        <View className="flex-row items-center justify-between gap-3 border-t border-primary/10 bg-primary/5 px-4 py-3">
          <Text className="font-inter-regular text-small text-ink-subtle">Average of {prices.length} sources</Text>
          <Text className="font-inter-bold text-body text-ink-emphasis">{formatPerUnit(average, unit)}</Text>
        </View>
      )}
    </SheetSection>
  );
}
