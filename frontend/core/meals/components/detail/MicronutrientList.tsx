import { Text, View } from "react-native";
import { colors } from "@/frontend/constants/theme";

// Fiber / sugar / sodium rows: dot, amount, a bar filled to the share of the
// daily value, and a verdict chip. Shared by the ingredient sheet (one
// ingredient at the quantity used) and the meal page (the meal per serving).

// Daily reference amounts (FDA, 2,000-calorie diet). Sugar has no official
// daily value, so it's measured against the 50g daily limit for added sugar.
// `goodWhenHigh`: fiber is something you want more of; sugar and sodium are
// things to keep down, so their verdicts flip.
const MICROS = [
  { key: "fiber", label: "Fiber", unit: "g", daily: 28, color: colors.primary, goodWhenHigh: true, of: "daily value" },
  { key: "sugar", label: "Sugar", unit: "g", daily: 50, color: colors.brandOrange, goodWhenHigh: false, of: "daily limit" },
  { key: "sodium", label: "Sodium", unit: "mg", daily: 2300, color: colors.info, goodWhenHigh: false, of: "daily value" },
] as const;
// FDA's rule of thumb for % daily value: 5% or less is low, 20% or more is high.
const DV_LOW = 5;
const DV_HIGH = 20;

export type Micronutrients = { fiber?: number; sugar?: number; sodium?: number };

export function hasMicronutrients(values: Micronutrients) {
  return values.fiber != null || values.sugar != null || values.sodium != null;
}

// "Good source" / "High" / "Low", or nothing in the unremarkable middle.
function Verdict({ pct, goodWhenHigh }: { pct: number; goodWhenHigh: boolean }) {
  let verdict: { label: string; good: boolean } | null = null;
  if (pct >= DV_HIGH) verdict = goodWhenHigh ? { label: "Good source", good: true } : { label: "High", good: false };
  else if (pct <= DV_LOW && !goodWhenHigh) verdict = { label: "Low", good: true };
  if (!verdict) return null;
  return (
    <View className={`rounded-full px-2 py-0.5 ${verdict.good ? "bg-primary/10" : "bg-like-soft"}`}>
      <Text className={`font-inter-semibold text-sub ${verdict.good ? "text-primary" : "text-like"}`}>{verdict.label}</Text>
    </View>
  );
}

type MicronutrientListProps = {
  /** The amounts shown. */
  values: Micronutrients;
  /** What the % daily value bars and verdicts are measured from, when that
   *  isn't `values` itself: e.g. the meal page shows the whole batch's
   *  amounts but keeps the bars per serving (a daily value is about one
   *  person's day). */
  shareOf?: Micronutrients;
  /** Appended to the "% of daily value" line, e.g. "per serving". */
  shareNote?: string;
};

/** The rows only (no card around them); rows without data are skipped. */
export function MicronutrientList({ values, shareOf = values, shareNote }: MicronutrientListProps) {
  return (
    <View className="gap-4">
      {MICROS.filter((m) => values[m.key] != null).map((m) => {
        const value = values[m.key]!;
        const pct = ((shareOf[m.key] ?? value) / m.daily) * 100;
        const amount = m.unit === "mg" ? `${Math.round(value).toLocaleString("en-US")}mg` : `${value.toFixed(1)}g`;
        return (
          <View key={m.key}>
            <View className="flex-row items-center gap-2">
              <View className="h-3 w-3 rounded-full" style={{ backgroundColor: m.color }} />
              <Text className="font-inter-semibold text-body text-ink-emphasis">{m.label}</Text>
              <Verdict pct={pct} goodWhenHigh={m.goodWhenHigh} />
              <Text className="ml-auto font-inter-extrabold text-body text-ink-emphasis">{amount}</Text>
            </View>
            {/* Bar fills to the share of the daily value (capped at full). */}
            <View className="mt-2 h-2 overflow-hidden rounded-full bg-web-divider">
              <View className="h-2 rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: m.color }} />
            </View>
            <Text className="mt-1 text-right font-inter-regular text-small text-ink-subtle">
              {pct > 0 && pct < 1 ? "<1" : Math.round(pct)}% of {m.of}
              {shareNote ? ` ${shareNote}` : ""}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
