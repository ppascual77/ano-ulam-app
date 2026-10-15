import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Spinner } from "@/frontend/components/ui";
import { AlertCircle, Check } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

// Small building blocks the admin tools share, so actions, statuses and
// errors look the same on every admin screen instead of each panel using
// its own colored caption text.

// ---- ActionChip --------------------------------------------------------------

type ActionChipProps = {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  /** "primary": a green-tinted action (the usual). "neutral": a quieter
   *  one (Skip, Hide). */
  tone?: "primary" | "neutral";
};

// A compact pill button for secondary, inline actions (Search USDA, AI
// estimate, Accept fix): clearly tappable, but lighter than a full Button.
export function ActionChip({ label, onPress, icon, loading = false, disabled = false, tone = "primary" }: ActionChipProps) {
  const primary = tone === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      hitSlop={4}
      className={`flex-row items-center gap-1.5 self-start rounded-full border px-3 py-1.5 ${
        primary ? "border-primary/25 bg-primary/5 active:bg-primary/15" : "border-ink-emphasis/15 active:bg-ink-emphasis/5"
      } ${disabled ? "opacity-40" : ""}`}
    >
      {loading ? <Spinner variant="wave" size={12} color={colors.accent} /> : icon}
      <Text className={`font-inter-semibold text-body ${primary ? "text-primary" : "text-ink-subtle"}`}>{label}</Text>
    </Pressable>
  );
}

// ---- StatusChip --------------------------------------------------------------

const STATUS_TONES = {
  success: { box: "bg-primary/10", text: "text-primary", color: colors.primary },
  danger: { box: "bg-like-soft", text: "text-like", color: colors.like },
  notice: { box: "bg-notice-bg", text: "text-notice-text", color: colors.notice.icon },
  neutral: { box: "bg-ink-emphasis/5", text: "text-ink-subtle", color: colors.ink.subtle },
} as const;

type StatusChipProps = {
  label: string;
  tone?: keyof typeof STATUS_TONES;
  /** Defaults to a check (success), an alert (danger/notice) or nothing. */
  icon?: ReactNode | null;
};

// A small read-only status pill: "Linked", "Not linked", "USDA", "HIGH".
export function StatusChip({ label, tone = "neutral", icon }: StatusChipProps) {
  const t = STATUS_TONES[tone];
  const defaultIcon =
    tone === "success" ? (
      <Check color={t.color} size={13} strokeWidth={3} />
    ) : tone === "danger" || tone === "notice" ? (
      <AlertCircle color={t.color} size={13} strokeWidth={2.5} />
    ) : null;
  const shown = icon === undefined ? defaultIcon : icon;
  return (
    <View className={`flex-row items-center gap-1 self-start rounded-full px-2.5 py-1 ${t.box}`}>
      {shown}
      <Text className={`font-inter-semibold text-small ${t.text}`}>{label}</Text>
    </View>
  );
}

// ---- InlineError ---------------------------------------------------------------

// A red message with an alert icon, for a failed action or a blocker.
export function InlineError({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row items-start gap-2">
      <View className="pt-0.5">
        <AlertCircle color={colors.like} size={15} />
      </View>
      <Text className="flex-1 font-inter-regular text-body leading-5 text-like">{children}</Text>
    </View>
  );
}

// ---- FieldLabel ----------------------------------------------------------------

// A label (with an optional hint) above a group of fields or chips inside a
// section ("Difficulty", "Database link").
export function FieldLabel({ children, hint }: { children: string; hint?: string }) {
  return (
    <View className="gap-0.5">
      <Text className="font-inter-semibold text-body-lg text-ink-emphasis">{children}</Text>
      {hint && <Text className="font-inter-regular text-body leading-5 text-ink-subtle">{hint}</Text>}
    </View>
  );
}

// ---- StatTiles -----------------------------------------------------------------

export type Stat = { label: string; value: string; emphasis?: boolean };

// A row of label-over-value tiles (an estimated total's price and macros).
export function StatTiles({ stats }: { stats: Stat[] }) {
  return (
    <View className="flex-row gap-2">
      {stats.map((s) => (
        <View key={s.label} className="flex-1 items-center gap-0.5 rounded-xl bg-white px-1 py-2.5">
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            className={`font-inter-extrabold ${s.emphasis ? "text-subheading text-primary" : "text-body-lg text-ink-emphasis"}`}
          >
            {s.value}
          </Text>
          <Text className="font-inter-medium text-small text-ink-subtle">{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ---- Checklist -----------------------------------------------------------------

export type ChecklistItem = { label: string; done: boolean; detail?: string };

// What's left before a save is allowed, as ticks instead of red warnings.
export function Checklist({ items }: { items: ChecklistItem[] }) {
  return (
    <View className="gap-2.5">
      {items.map((item) => (
        <View key={item.label} className="flex-row items-start gap-2.5">
          <View
            className={`h-5 w-5 items-center justify-center rounded-full ${item.done ? "bg-primary" : "border border-ink-emphasis/20"}`}
          >
            {item.done && <Check color={colors.white} size={12} strokeWidth={3.5} />}
          </View>
          <View className="flex-1">
            <Text className={`font-inter-semibold text-body ${item.done ? "text-ink-emphasis" : "text-ink"}`}>{item.label}</Text>
            {item.detail && <Text className="font-inter-regular text-small text-ink-subtle">{item.detail}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

// ---- ConfidenceChip ------------------------------------------------------------

const CONFIDENCE_TONES = { HIGH: "success", LOW: "notice", NONE: "neutral", ERROR: "danger" } as const;

// A grounding result's HIGH / LOW / NONE / ERROR, colored by how much to
// trust it.
export function ConfidenceChip({ confidence }: { confidence: string }) {
  const tone = CONFIDENCE_TONES[confidence as keyof typeof CONFIDENCE_TONES] ?? "neutral";
  return <StatusChip label={confidence} tone={tone} icon={null} />;
}

// ---- SelectBox -----------------------------------------------------------------

// The square tick box used to pick rows (grounding results, include toggles).
export function SelectBox({ checked }: { checked: boolean }) {
  return (
    <View className={`h-6 w-6 items-center justify-center rounded-md ${checked ? "bg-primary" : "border-2 border-primary/30"}`}>
      {checked && <Check color={colors.white} size={14} strokeWidth={3} />}
    </View>
  );
}
