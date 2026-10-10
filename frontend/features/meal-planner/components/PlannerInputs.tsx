import { ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { ChartColumn, ChevronRight, Lightbulb, Users, Wallet, type LucideIcon } from "lucide-react-native";
import { Stepper, Toggle } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { GOAL_OPTIONS, type Goal, type MacroTargets } from "../utils/macros";

export const MAX_SERVINGS = 10;

// Digits only, shown with thousands separators ("1500" -> "1,500").
export const parseBudget = (text: string) => Number(text.replace(/[^0-9]/g, "")) || 0;
const formatBudget = (text: string) => {
  const digits = text.replace(/[^0-9]/g, "").slice(0, 7);
  return digits ? Number(digits).toLocaleString("en-PH") : "";
};

// Icon tile + title + one-line description: the head of each setup card.
function CardHead({ Icon, tone = "green", title, optional, body, trailing }: { Icon: LucideIcon; tone?: "green" | "orange"; title: string; optional?: boolean; body: string; trailing?: ReactNode }) {
  const orange = tone === "orange";
  return (
    <View className="flex-row items-center gap-3">
      <View className={`h-10 w-10 items-center justify-center rounded-xl ${orange ? "bg-brand-orange/15" : "bg-white"}`}>
        <Icon color={orange ? colors.brandOrange : colors.brandGreen.DEFAULT} size={20} />
      </View>
      <View className="flex-1">
        <Text className="font-inter-semibold text-body text-web-ink">
          {title}
          {optional && <Text className="font-inter-regular text-web-ink-muted"> (Optional)</Text>}
        </Text>
        <Text className="mt-0.5 font-inter-regular text-small text-web-ink-muted">{body}</Text>
      </View>
      {trailing}
    </View>
  );
}

function SetupCard({ children }: { children: ReactNode }) {
  return <View className="gap-3 rounded-2xl bg-brand-green/5 p-4">{children}</View>;
}

export function BudgetInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <SetupCard>
      <CardHead Icon={Wallet} title="Weekly budget" body="We'll find the best meals within your budget." />
      <View className="flex-row items-center rounded-xl border border-web-divider bg-white px-4 py-3">
        <Text className="font-inter-semibold text-subheading text-web-ink">₱</Text>
        <View className="mx-3 h-5 w-px bg-web-divider" />
        <TextInput
          value={value}
          onChangeText={(text) => onChange(formatBudget(text))}
          placeholder="e.g. 1,500"
          placeholderTextColor={colors.ink.placeholder}
          keyboardType="number-pad"
          returnKeyType="done"
          className="flex-1 font-inter-extrabold text-subheading text-web-ink"
          style={{ padding: 0 }}
        />
      </View>
    </SetupCard>
  );
}

export function ServingStepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <SetupCard>
      <CardHead Icon={Users} title="How many people?" body="We'll adjust ingredient quantities for you." />
      {/* The same stepper as Home's Serving box, a size up. */}
      <View className="pl-[52px]">
        <Stepper
          size="lg"
          value={value}
          onChange={onChange}
          min={1}
          max={MAX_SERVINGS}
          decrementLabel="Fewer people"
          incrementLabel="More people"
        />
      </View>
    </SetupCard>
  );
}

type MacroGoalCardProps = {
  targets: MacroTargets | null;
  goal: Goal | null;
  /** Toggle on: opens the nutrition sheet. */
  onEnable: () => void;
  /** Tap the enabled card: edit. */
  onEdit: () => void;
};

// Off: toggle + a "not sure about macros?" reassurance. On: a summary card
// (tap to edit stats, goal or targets).
export function MacroGoalCard({ targets, goal, onEnable, onEdit }: MacroGoalCardProps) {
  if (targets) {
    const goalLabel = GOAL_OPTIONS.find((o) => o.value === goal)?.label;
    return (
      <Pressable onPress={onEdit} className="flex-row items-center gap-3 rounded-2xl border border-web-divider bg-white p-4 active:bg-web-divider/40">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-orange/15">
          <ChartColumn color={colors.brandOrange} size={20} />
        </View>
        <View className="flex-1">
          <Text className="font-inter-semibold text-body text-web-ink">Macro goal enabled</Text>
          <Text className="mt-0.5 font-inter-regular text-small text-web-ink-body">
            {targets.calories.toLocaleString("en-PH")} kcal · {targets.protein}g protein{goalLabel ? ` · ${goalLabel}` : ""}
          </Text>
        </View>
        <ChevronRight color={colors.webInk.muted} size={18} />
      </Pressable>
    );
  }
  return (
    <SetupCard>
      <CardHead
        Icon={ChartColumn}
        tone="orange"
        title="Set a macro goal"
        optional
        body="Plan around calories and macros."
        trailing={<Toggle checked={false} onChange={(on) => on && onEnable()} />}
      />
      <View className="flex-row items-start gap-3 rounded-xl bg-notice-bg px-3 py-2.5">
        <Lightbulb color={colors.notice.icon} size={16} />
        <View className="flex-1">
          <Text className="font-inter-semibold text-small text-notice-text">Not sure about macros?</Text>
          <Text className="font-inter-regular text-small text-notice-text">You can always skip this and set it later.</Text>
        </View>
      </View>
    </SetupCard>
  );
}
