import { Pressable, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { Lock } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { ProBadge } from "@/frontend/core/pro/components/ProBadge";
import { GrowFill } from "./GrowFill";

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
  /** The ingredient sheet's tighter rows: no dot, amount and % on one line,
   *  thinner bars that grow in on mount, and their own padding so they sit
   *  straight in a card. The "% of daily value" note is the caller's. */
  compact?: boolean;
  /** compact only: ms before the first bar starts growing. */
  growDelay?: number;
};

function formatAmount(value: number, unit: string) {
  return unit === "mg" ? `${Math.round(value).toLocaleString("en-US")}mg` : `${value.toFixed(1)}g`;
}

function formatPct(pct: number) {
  return pct > 0 && pct < 1 ? "<1" : `${Math.round(pct)}`;
}

/** The rows only (no card around them); rows without data are skipped. */
export function MicronutrientList({ values, shareOf = values, shareNote, compact = false, growDelay = 0 }: MicronutrientListProps) {
  if (compact) {
    return (
      <View className="gap-4 p-4">
        {MICROS.filter((m) => values[m.key] != null).map((m, i) => {
          const value = values[m.key]!;
          const pct = ((shareOf[m.key] ?? value) / m.daily) * 100;
          return (
            <View key={m.key}>
              <View className="flex-row items-center gap-2">
                <Text className="font-inter-semibold text-body text-ink-emphasis">{m.label}</Text>
                <Verdict pct={pct} goodWhenHigh={m.goodWhenHigh} />
                <Text className="ml-auto font-inter-bold text-body text-ink-emphasis">
                  {formatAmount(value, m.unit)}
                  <Text className="font-inter-medium text-ink-subtle">{`  ·  ${formatPct(pct)}%`}</Text>
                </Text>
              </View>
              <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-web-divider">
                <GrowFill
                  percent={Math.min(100, pct)}
                  delay={growDelay + i * 60}
                  style={{ height: "100%", borderRadius: 999, backgroundColor: m.color }}
                />
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View className="gap-4">
      {MICROS.filter((m) => values[m.key] != null).map((m) => {
        const value = values[m.key]!;
        const pct = ((shareOf[m.key] ?? value) / m.daily) * 100;
        const amount = formatAmount(value, m.unit);
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
              {formatPct(pct)}% of {m.of}
              {shareNote ? ` ${shareNote}` : ""}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// Sample fills for the locked bars: a believable spread, never the meal's
// real values (nothing to read off a locked row).
const SAMPLE_FILLS = ["45%", "62%", "34%"] as const;

type LockedMicronutrientsProps = {
  /** Which rows this meal or ingredient has (only their labels show). */
  values: Micronutrients;
  /** Opens the Pro upsell. Without it the unlock row is just a label. */
  onUnlock?: () => void;
  /** The ingredient sheet's card layout: compact rows (see
   *  MicronutrientList's `compact`) with the unlock row as the card's
   *  full-width footer. */
  compact?: boolean;
};

/** Micronutrients for a free user: the same rows (dot and label real), with
 *  the amounts as soft placeholders and faded sample bars, then a way into
 *  Pro. Shows what Pro adds without showing the numbers. */
export function LockedMicronutrients({ values, onUnlock, compact = false }: LockedMicronutrientsProps) {
  if (compact) {
    return (
      <View>
        <View className="gap-4 p-4" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {MICROS.filter((m) => values[m.key] != null).map((m, i) => (
            <View key={m.key}>
              <View className="flex-row items-center gap-2">
                <Text className="font-inter-semibold text-body text-ink-emphasis">{m.label}</Text>
                <View className="ml-auto h-3 w-14 rounded-full bg-ink-emphasis/10" />
              </View>
              <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-web-divider">
                <View className="h-full rounded-full" style={{ width: SAMPLE_FILLS[i % SAMPLE_FILLS.length], backgroundColor: m.color, opacity: 0.25 }} />
              </View>
            </View>
          ))}
        </View>
        <Pressable
          onPress={onUnlock}
          disabled={!onUnlock}
          accessibilityRole="button"
          accessibilityLabel="Fiber, sugar and sodium are part of Pro. See them with Pro."
          className="flex-row items-center gap-3 border-t border-accent/10 bg-accent/5 px-4 py-3 active:opacity-70"
        >
          <Lock color={colors.accent} size={16} />
          <Text className="flex-1 font-inter-semibold text-body text-ink-emphasis">See fiber, sugar and sodium</Text>
          <ProBadge />
        </Pressable>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <View className="gap-4" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {MICROS.filter((m) => values[m.key] != null).map((m, i) => (
          <View key={m.key}>
            <View className="flex-row items-center gap-2">
              <View className="h-3 w-3 rounded-full" style={{ backgroundColor: m.color }} />
              <Text className="font-inter-semibold text-body text-ink-emphasis">{m.label}</Text>
              <View className="ml-auto h-3.5 w-14 rounded-full bg-ink-emphasis/10" />
            </View>
            <View className="mt-2 h-2 overflow-hidden rounded-full bg-web-divider">
              <View className="h-2 rounded-full" style={{ width: SAMPLE_FILLS[i % SAMPLE_FILLS.length], backgroundColor: m.color, opacity: 0.25 }} />
            </View>
            <View className="mt-1.5 h-2.5 w-24 self-end rounded-full bg-ink-emphasis/5" />
          </View>
        ))}
      </View>
      <Pressable
        onPress={onUnlock}
        disabled={!onUnlock}
        accessibilityRole="button"
        accessibilityLabel="Fiber, sugar and sodium are part of Pro. See them with Pro."
        className="flex-row items-center gap-3 rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3 active:opacity-70"
      >
        <Lock color={colors.accent} size={16} />
        <Text className="flex-1 font-inter-semibold text-body text-ink-emphasis">See fiber, sugar and sodium</Text>
        <ProBadge />
      </Pressable>
    </View>
  );
}

