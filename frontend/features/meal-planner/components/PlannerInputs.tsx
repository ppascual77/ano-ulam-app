import { ReactNode, useRef } from "react";
import { Pressable, Text, TextInput, View, type TextInputInstance } from "react-native";
import { CalendarDays, ChartColumn, ChevronRight, Lock, Users, type LucideIcon } from "lucide-react-native";
import { RollingText, Stepper, Toggle } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { ProBadge } from "@/frontend/core/pro/components/ProBadge";
import { GOAL_OPTIONS, type Goal, type MacroTargets } from "@/frontend/core/nutrition/macros";
import { monthDay } from "../utils/generatePlan";

export const MAX_SERVINGS = 10;

// Digits only, shown with thousands separators ("1500" -> "1,500").
export const parseBudget = (text: string) => Number(text.replace(/[^0-9]/g, "")) || 0;
const formatBudget = (text: string) => {
  const digits = text.replace(/[^0-9]/g, "").slice(0, 7);
  return digits ? Number(digits).toLocaleString("en-PH") : "";
};

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short" });

// ---- Budget ----------------------------------------------------------------

type BudgetHeroProps = {
  value: string;
  onChange: (value: string) => void;
  /** People and days, for the "per person, per day" line. */
  servings: number;
  days: number;
};

// The setup's hero: the weekly budget as one big figure you type straight
// into, and what it works out to per person per day (rolls as either
// changes), so the number means something before planning.
export function BudgetHero({ value, onChange, servings, days }: BudgetHeroProps) {
  const input = useRef<TextInputInstance | null>(null);
  const budget = parseBudget(value);
  const perDay = budget > 0 ? Math.round(budget / Math.max(1, servings) / Math.max(1, days)) : 0;

  return (
    <View className="rounded-3xl bg-mood-bg p-5">
      <Text className="font-inter-semibold text-sub uppercase tracking-widest text-ink-subtle">Weekly budget</Text>
      {/* The whole row focuses the field, so the ₱ is a tap target too. */}
      <Pressable onPress={() => input.current?.focus()} accessible={false} className="mt-2 flex-row items-center">
        <Text className="font-inter-extrabold text-heading-lg text-primary">₱</Text>
        <TextInput
          ref={input}
          value={value}
          onChangeText={(text) => onChange(formatBudget(text))}
          placeholder="0"
          placeholderTextColor={colors.ink.placeholder}
          keyboardType="number-pad"
          returnKeyType="done"
          accessibilityLabel="Weekly budget in pesos"
          className="ml-1.5 flex-1 font-inter-extrabold text-subhero tracking-display text-ink-emphasis"
          style={{ padding: 0 }}
        />
      </Pressable>
      <View className="mt-4 flex-row items-center justify-between border-t border-primary/10 pt-3">
        <Text className="font-inter-regular text-small text-ink-subtle">About per person, per day</Text>
        <View className="flex-row items-center gap-1">
          {perDay > 0 ? (
            <RollingText value={`₱${perDay.toLocaleString("en-PH")}`} rank={perDay} className="font-inter-extrabold text-subheading text-primary" />
          ) : (
            <Text className="font-inter-extrabold text-subheading text-ink-placeholder">₱–</Text>
          )}
          <Text className="font-inter-semibold text-small text-ink-subtle">/ day</Text>
        </View>
      </View>
    </View>
  );
}

// ---- Plan details (people, days, macro goal) ---------------------------------

/** One row of the details card: icon tile, title, one-line detail, and
 *  whatever control sits on the right. */
function DetailRow({
  Icon,
  tile = "green",
  title,
  detail,
  trailing,
  divided,
  onPress,
  accessibilityLabel,
}: {
  Icon: LucideIcon;
  /** "accent": a solid orange tile (Pro), "accentSoft": a tinted one. */
  tile?: "green" | "accent" | "accentSoft";
  title: ReactNode;
  detail: string;
  trailing?: ReactNode;
  divided?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const tileClass = tile === "accent" ? "bg-accent" : tile === "accentSoft" ? "bg-accent/15" : "bg-primary/10";
  const iconColor = tile === "accent" ? colors.white : tile === "accentSoft" ? colors.accent : colors.primary;
  const content = (
    <>
      <View className={`h-9 w-9 items-center justify-center rounded-xl ${tileClass}`}>
        <Icon color={iconColor} size={18} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">{title}</View>
        <Text className="mt-0.5 font-inter-regular text-small text-ink-subtle">{detail}</Text>
      </View>
      {trailing}
    </>
  );
  const rowClass = `flex-row items-center gap-3 px-4 py-3.5 ${divided ? "border-t border-ink-emphasis/5" : ""}`;
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} className={`${rowClass} active:bg-primary/5`}>
      {content}
    </Pressable>
  ) : (
    <View className={rowClass}>{content}</View>
  );
}

function RowTitle({ children }: { children: ReactNode }) {
  return <Text className="font-inter-semibold text-body text-ink-emphasis">{children}</Text>;
}

type PlanDetailsCardProps = {
  servings: number;
  onServingsChange: (value: number) => void;
  /** Days in a new plan (5, or Pro's 5/7 from Settings), starting today. */
  days: number;
  targets: MacroTargets | null;
  goal: Goal | null;
  /** Toggle on: opens the nutrition sheet. */
  onEnableMacros: () => void;
  /** Tap the set goal: edit it. */
  onEditMacros: () => void;
  /** The targets are your saved nutrition goals (Pro): labelled as such. */
  fromGoals?: boolean;
  /** Free: macro goals are Pro (they're nutrition goals). The row shows the
   *  PRO badge and a lock, and opens the Pro page. */
  macrosLocked?: boolean;
  onMacrosLocked?: () => void;
};

// Everything after the budget, as one grouped card: how many people, how
// many days, and the optional macro goal.
export function PlanDetailsCard({
  servings,
  onServingsChange,
  days,
  targets,
  goal,
  onEnableMacros,
  onEditMacros,
  fromGoals = false,
  macrosLocked = false,
  onMacrosLocked,
}: PlanDetailsCardProps) {
  const today = new Date();
  const goalLabel = GOAL_OPTIONS.find((o) => o.value === goal)?.label;

  return (
    <View className="overflow-hidden rounded-2xl border border-primary/10 bg-white">
      <DetailRow
        Icon={Users}
        title={<RowTitle>People</RowTitle>}
        detail="Quantities and costs scale to fit"
        trailing={
          <Stepper
            value={servings}
            onChange={onServingsChange}
            min={1}
            max={MAX_SERVINGS}
            decrementLabel="Fewer people"
            incrementLabel="More people"
          />
        }
      />
      <DetailRow
        Icon={CalendarDays}
        divided
        title={<RowTitle>Days</RowTitle>}
        detail={`Starting today, ${WEEKDAY.format(today)} ${monthDay(today)}`}
        trailing={<Text className="font-inter-semibold text-body text-ink-emphasis">{days} days</Text>}
      />
      {macrosLocked ? (
        <DetailRow
          Icon={ChartColumn}
          tile="accent"
          divided
          onPress={onMacrosLocked}
          accessibilityLabel="Macro goal, a Pro feature. Unlock with Pro"
          title={
            <>
              <RowTitle>Macro goal</RowTitle>
              <ProBadge />
            </>
          }
          detail="Aim every day at your calories and protein"
          trailing={<Lock color={colors.accent} size={16} strokeWidth={2.5} />}
        />
      ) : targets ? (
        <DetailRow
          Icon={ChartColumn}
          tile="accentSoft"
          divided
          onPress={onEditMacros}
          accessibilityLabel="Edit macro goal"
          title={<RowTitle>{fromGoals ? "Your nutrition goals" : "Macro goal"}</RowTitle>}
          detail={`${targets.calories.toLocaleString("en-PH")} kcal · ${targets.protein}g protein${goalLabel ? ` · ${goalLabel}` : ""}`}
          trailing={<ChevronRight color={colors.ink.subtle} size={18} />}
        />
      ) : (
        <DetailRow
          Icon={ChartColumn}
          tile="accentSoft"
          divided
          title={
            <RowTitle>
              Macro goal <Text className="font-inter-regular text-ink-subtle">(Optional)</Text>
            </RowTitle>
          }
          detail="Plan around calories and macros"
          trailing={<Toggle checked={false} onChange={(on) => on && onEnableMacros()} />}
        />
      )}
    </View>
  );
}
