import { ReactNode, useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { ArrowRight, ChartColumn, ChevronRight, Lightbulb, Lock, Users, Wallet, type LucideIcon } from "lucide-react-native";
import { PulsePressable, Stepper, Toggle } from "@/frontend/components/ui";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { colors } from "@/frontend/constants/theme";
import { ProBadge } from "@/frontend/core/pro/components/ProBadge";
import { GOAL_OPTIONS, type Goal, type MacroTargets } from "@/frontend/core/nutrition/macros";

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
  /** The targets are your saved nutrition goals (Pro): labelled as such. */
  fromGoals?: boolean;
  /** Free: macro goals are Pro (they're nutrition goals). The card shows
   *  the PRO badge, and any tap opens the upsell instead. */
  locked?: boolean;
  onLocked?: () => void;
};

// Off: toggle + a "not sure about macros?" reassurance. On: a summary card
// (tap to edit stats, goal or targets).
export function MacroGoalCard({ targets, goal, onEnable, onEdit, fromGoals = false, locked = false, onLocked }: MacroGoalCardProps) {
  if (locked) return <LockedMacroGoalCard onPress={onLocked} />;
  if (targets) {
    const goalLabel = GOAL_OPTIONS.find((o) => o.value === goal)?.label;
    return (
      <Pressable onPress={onEdit} className="flex-row items-center gap-3 rounded-2xl border border-web-divider bg-white p-4 active:bg-web-divider/40">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-orange/15">
          <ChartColumn color={colors.brandOrange} size={20} />
        </View>
        <View className="flex-1">
          <Text className="font-inter-semibold text-body text-web-ink">{fromGoals ? "Your nutrition goals" : "Macro goal enabled"}</Text>
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

// ---- Locked macro goal (Free) ---------------------------------------------

// The preview bars: a balanced day's shape, no numbers (they'd read as the
// user's data). Each fills to its share as the card appears, one after
// another.
const PREVIEW_BARS = [
  { label: "Calories", share: 0.78 },
  { label: "Protein", share: 0.62 },
  { label: "Carbs", share: 0.45 },
];
const BAR_MS = 700;
const BAR_STAGGER = 110;
// The light sweep: a soft white band crossing the card, then a rest.
const SWEEP_MS = 1100;
const SWEEP_REST_MS = 2600;
const SWEEP_WIDTH = 90;
const SWEEP_BAND = ["rgba(255,255,255,0)", "rgba(255,255,255,0.55)", "rgba(255,255,255,0)"] as const;

function PreviewBar({ label, share, index, reduceMotion }: { label: string; share: number; index: number; reduceMotion: boolean }) {
  const fill = useSharedValue(reduceMotion ? share : 0);
  useEffect(() => {
    if (reduceMotion) return;
    fill.value = withDelay(250 + index * BAR_STAGGER, withTiming(share, { duration: BAR_MS, easing: Easing.out(Easing.cubic) }));
    // Once, as the card appears.
  }, []);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View className="flex-1 gap-1.5 rounded-xl bg-white px-3 py-2.5">
      <Text className="font-inter-semibold text-sub uppercase text-ink-subtle">{label}</Text>
      <View className="h-1.5 overflow-hidden rounded-full bg-accent/10">
        <Animated.View style={[{ height: "100%", borderRadius: 999, backgroundColor: colors.accent }, fillStyle]} />
      </View>
    </View>
  );
}

// "Set a macro goal" for a free user: a premium card in Pro's accent orange
// (a solid accent icon tile, the PRO badge, a lock), a preview of a
// balanced day, and "Unlock with Pro". A soft light sweeps across it now and
// then. Any tap opens the Pro page. With Reduce motion: no sweep, the bars
// show filled.
function LockedMacroGoalCard({ onPress }: { onPress?: () => void }) {
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion || width === 0) return;
    sweep.value = withDelay(
      900,
      withRepeat(
        withSequence(
          withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: SWEEP_REST_MS }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(sweep);
  }, [width, reduceMotion]);
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -SWEEP_WIDTH * 2 + (width + SWEEP_WIDTH * 3) * sweep.value }, { rotate: "18deg" }],
  }));

  return (
    <PulsePressable
      onPress={onPress}
      radius={16}
      ringColor={colors.accent}
      pulse="subtle"
      accessibilityRole="button"
      accessibilityLabel="Set a macro goal, a Pro feature. Unlock with Pro"
    >
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        className="gap-3.5 overflow-hidden rounded-2xl border border-accent/25 bg-accent/5 p-4"
      >
        {!reduceMotion && (
          <Animated.View pointerEvents="none" style={[{ position: "absolute", top: -40, bottom: -40, left: 0, width: SWEEP_WIDTH }, sweepStyle]}>
            <LinearGradient colors={SWEEP_BAND} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
          </Animated.View>
        )}

        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent">
            <ChartColumn color={colors.white} size={20} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="font-inter-semibold text-body text-ink-emphasis">Set a macro goal</Text>
              <ProBadge />
            </View>
            <Text className="mt-0.5 font-inter-regular text-small text-ink-subtle">Plan every day around your calories and protein.</Text>
          </View>
          <View className="h-8 w-8 items-center justify-center rounded-full bg-accent/10">
            <Lock color={colors.accent} size={14} strokeWidth={2.5} />
          </View>
        </View>

        <View className="flex-row gap-2">
          {PREVIEW_BARS.map((bar, i) => (
            <PreviewBar key={bar.label} label={bar.label} share={bar.share} index={i} reduceMotion={reduceMotion} />
          ))}
        </View>

        <View className="flex-row items-center justify-end gap-1">
          <Text className="font-inter-semibold text-small text-accent">Unlock with Pro</Text>
          <ArrowRight color={colors.accent} size={14} strokeWidth={2.5} />
        </View>
      </View>
    </PulsePressable>
  );
}
