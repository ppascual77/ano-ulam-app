import { ReactNode, useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Calendar,
  ChartColumn,
  Check,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  Leaf,
  Lightbulb,
  Pencil,
  Percent,
  Ruler,
  Scale,
  Sofa,
  Target,
  Trophy,
  Wheat,
  type LucideIcon,
} from "lucide-react-native";
import { BottomSheet, Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import {
  ACTIVITY_OPTIONS,
  GOAL_OPTIONS,
  recommendTargets,
  type Activity,
  type BodyStats,
  type Goal,
  type MacroTargets,
  type Sex,
} from "../utils/macros";

// The app doesn't store body stats anywhere yet, so the planner remembers
// what was entered here, on this device, to prefill next time.
const STATS_KEY = "planner_body_stats";

type Step = "intro" | "stats" | "goal" | "targets";
const PREVIOUS: Record<Step, Step | null> = { intro: null, stats: "intro", goal: "stats", targets: "goal" };

type Draft = { weight: string; height: string; age: string; sex: Sex; bodyFat: string; goal: Goal; activity: Activity };
const EMPTY_DRAFT: Draft = { weight: "", height: "", age: "", sex: "male", bodyFat: "", goal: "maintain", activity: "moderate" };

const GOAL_ICONS: Record<Goal, LucideIcon> = { lose: Flame, build: Dumbbell, maintain: Scale };
const ACTIVITY_ICONS: Record<Activity, LucideIcon> = { sedentary: Sofa, light: Footprints, moderate: Dumbbell, very: Bike, athlete: Trophy };

const num = (text: string) => Number(text.replace(/[^0-9.]/g, ""));
const inRange = (value: number, min: number, max: number) => value >= min && value <= max;

function toStats(draft: Draft): BodyStats | null {
  const weightKg = num(draft.weight);
  const heightCm = num(draft.height);
  const age = num(draft.age);
  const bodyFatPct = draft.bodyFat.trim() ? num(draft.bodyFat) : null;
  if (!inRange(weightKg, 30, 250) || !inRange(heightCm, 120, 230) || !inRange(age, 13, 100)) return null;
  if (bodyFatPct != null && !inRange(bodyFatPct, 3, 60)) return null;
  return { weightKg, heightCm, age, sex: draft.sex, bodyFatPct };
}

function Title({ title, body, centered = false }: { title: string; body: string; centered?: boolean }) {
  const align = centered ? "text-center" : "";
  return (
    <View className={centered ? "items-center" : ""}>
      <Text className={`font-inter-semibold text-heading text-web-ink ${align}`}>{title}</Text>
      <Text className={`mt-1 px-4 font-inter-regular text-body text-web-ink-muted ${align}`}>{body}</Text>
    </View>
  );
}

// Icon + label + value input on a soft fill.
function StatField({ Icon, label, value, onChange, decimal }: { Icon: LucideIcon; label: string; value: string; onChange: (v: string) => void; decimal?: boolean }) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-web-divider/70 px-4 py-3">
      <Icon color={colors.webInk.muted} size={18} />
      <View className="flex-1">
        <Text className="font-inter-regular text-sub text-web-ink-muted">{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType={decimal ? "decimal-pad" : "number-pad"}
          className="mt-0.5 font-inter-semibold text-body text-web-ink"
          style={{ padding: 0 }}
        />
      </View>
    </View>
  );
}

function Selectable({ selected, onPress, children, className = "" }: { selected: boolean; onPress: () => void; children: ReactNode; className?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityState={{ selected }}
      className={`rounded-2xl border ${selected ? "border-brand-green bg-brand-green/5" : "border-web-divider bg-white"} ${className}`}
    >
      {children}
    </Pressable>
  );
}

function MacroTile({ Icon, tint, color, value, label, pct }: { Icon: LucideIcon; tint: string; color: string; value: number; label: string; pct: number }) {
  return (
    <View className="flex-1 items-center gap-1 rounded-2xl border border-web-divider bg-white py-3">
      <View className={`h-8 w-8 items-center justify-center rounded-lg ${tint}`}>
        <Icon color={color} size={16} />
      </View>
      <Text className="font-inter-bold text-body text-web-ink">{value}g</Text>
      <Text className="font-inter-regular text-sub text-web-ink-muted">
        {label} ({pct}%)
      </Text>
    </View>
  );
}

type MacroGoalSheetProps = {
  visible: boolean;
  /** Current targets/goal, when editing an enabled goal. */
  initialTargets: MacroTargets | null;
  initialGoal: Goal | null;
  onClose: () => void;
  onConfirm: (targets: MacroTargets, goal: Goal) => void;
  /** Editing only: switch the macro goal off. */
  onTurnOff?: () => void;
};

// "Set your nutrition goal", one step at a time: intro -> your stats ->
// goal + activity -> recommended targets (use, or adjust first).
export function MacroGoalSheet({ visible, initialTargets, initialGoal, onClose, onConfirm, onTurnOff }: MacroGoalSheetProps) {
  const [step, setStep] = useState<Step>("intro");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [targets, setTargets] = useState<MacroTargets | null>(initialTargets);
  const [adjusting, setAdjusting] = useState(false);

  // On open: prefill remembered stats; editing an enabled goal starts on
  // its targets.
  useEffect(() => {
    if (!visible) return;
    setAdjusting(false);
    setTargets(initialTargets);
    setStep(initialTargets ? "targets" : "intro");
    AsyncStorage.getItem(STATS_KEY)
      .then((raw) => raw && setDraft((prev) => ({ ...prev, ...JSON.parse(raw), ...(initialGoal ? { goal: initialGoal } : {}) })))
      .catch(() => {});
  }, [visible]);

  const stats = toStats(draft);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

  const calculate = () => {
    if (!stats) return;
    AsyncStorage.setItem(STATS_KEY, JSON.stringify(draft)).catch(() => {});
    setTargets(recommendTargets(stats, draft.goal, draft.activity));
    setAdjusting(false);
    setStep("targets");
  };

  const editTarget = (key: keyof MacroTargets, text: string) =>
    setTargets((prev) => (prev ? { ...prev, [key]: Math.round(num(text)) || 0 } : prev));

  const back = PREVIOUS[step];
  const goalLabel = GOAL_OPTIONS.find((o) => o.value === draft.goal)?.label;
  const pct = (grams: number, kcalPerGram: number) => (targets && targets.calories > 0 ? Math.round(((grams * kcalPerGram) / targets.calories) * 100) : 0);

  return (
    // Sized to the current step (up to 92% of the screen, then it scrolls).
    <BottomSheet visible={visible} onClose={onClose} heightPercent={0.92} fitContent>
      {/* Back arrow from the second step on; close by swiping down or tapping outside. */}
      <View className="flex-row items-center px-5 pt-8">
        {back && (
          <Pressable onPress={() => setStep(back)} hitSlop={10} accessibilityLabel="Back">
            <ArrowLeft color={colors.webInk.DEFAULT} size={20} />
          </Pressable>
        )}
      </View>

      <View className="px-6 pb-10 pt-3">
        {/* Keyed by step: each step fades in. */}
        <Animated.View key={step} entering={FadeIn.duration(220)} className="gap-5">
          {step === "intro" && (
            <>
              <Title centered title="Set your nutrition goal" body="We'll use your stats to calculate your daily calorie and macro targets for a more personalized meal plan." />
              <View className="gap-4 rounded-2xl bg-brand-green/5 p-4">
                {[
                  { Icon: Target, text: "Meals matched to your goal" },
                  { Icon: ChartColumn, text: "Balanced calories and macros" },
                  { Icon: Leaf, text: "Still budget-friendly" },
                ].map(({ Icon, text }) => (
                  <View key={text} className="flex-row items-center gap-3">
                    <Icon color={colors.brandGreen.DEFAULT} size={20} />
                    <Text className="font-inter-medium text-body text-web-ink-soft">{text}</Text>
                  </View>
                ))}
              </View>
              <Button label="Get Started" icon={<ArrowRight color={colors.white} size={18} />} iconPosition="right" onPress={() => setStep("stats")} />
            </>
          )}

          {step === "stats" && (
            <>
              <Title title="Your stats" body="This helps us calculate your calorie and macro targets." />
              <View className="gap-3">
                <StatField Icon={Scale} label="Weight (kg)" value={draft.weight} onChange={(v) => set("weight", v)} decimal />
                <StatField Icon={Ruler} label="Height (cm)" value={draft.height} onChange={(v) => set("height", v)} />
                <StatField Icon={Calendar} label="Age" value={draft.age} onChange={(v) => set("age", v)} />
                <View className="flex-row items-center gap-3 rounded-xl bg-web-divider/70 px-4 py-3">
                  <Text className="flex-1 font-inter-regular text-small text-web-ink-muted">Sex</Text>
                  {(["male", "female"] as Sex[]).map((sex) => (
                    <Pressable
                      key={sex}
                      onPress={() => set("sex", sex)}
                      className={`rounded-lg border px-4 py-1.5 ${draft.sex === sex ? "border-brand-green bg-brand-green/10" : "border-web-divider bg-white"}`}
                    >
                      <Text className={`font-inter-medium text-small ${draft.sex === sex ? "text-brand-green" : "text-web-ink-soft"}`}>
                        {sex === "male" ? "Male" : "Female"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <StatField Icon={Percent} label="Body fat % (optional)" value={draft.bodyFat} onChange={(v) => set("bodyFat", v)} decimal />
              </View>
              <Button label="Continue" icon={<ArrowRight color={colors.white} size={18} />} iconPosition="right" onPress={() => setStep("goal")} disabled={!stats} />
            </>
          )}

          {step === "goal" && (
            <>
              <Text className="font-inter-semibold text-heading text-web-ink">What's your main goal?</Text>
              <View className="flex-row gap-2">
                {GOAL_OPTIONS.map((option) => {
                  const Icon = GOAL_ICONS[option.value];
                  const selected = draft.goal === option.value;
                  return (
                    <Selectable key={option.value} selected={selected} onPress={() => set("goal", option.value)} className="flex-1 items-center gap-1.5 px-2 py-3">
                      <Icon color={selected ? colors.brandGreen.DEFAULT : colors.brandOrange} size={22} />
                      <Text className="text-center font-inter-semibold text-small text-web-ink">{option.label}</Text>
                      <Text className="text-center font-inter-regular text-sub leading-4 text-web-ink-muted">{option.description}</Text>
                      {selected && (
                        <View className="absolute right-1.5 top-1.5 h-4 w-4 items-center justify-center rounded-full bg-brand-green">
                          <Check color={colors.white} size={10} strokeWidth={3} />
                        </View>
                      )}
                    </Selectable>
                  );
                })}
              </View>

              <View>
                <Text className="font-inter-bold text-subheading text-web-ink">Activity level</Text>
                <Text className="mt-0.5 font-inter-regular text-small text-web-ink-muted">How active are you on a weekly basis?</Text>
              </View>
              <View className="gap-2">
                {ACTIVITY_OPTIONS.map((option) => {
                  const Icon = ACTIVITY_ICONS[option.value];
                  const selected = draft.activity === option.value;
                  return (
                    <Selectable key={option.value} selected={selected} onPress={() => set("activity", option.value)} className="flex-row items-center gap-3 px-4 py-3">
                      <Icon color={selected ? colors.brandGreen.DEFAULT : colors.webInk.muted} size={18} />
                      <View className="flex-1">
                        <Text className="font-inter-semibold text-small text-web-ink">{option.label}</Text>
                        <Text className="font-inter-regular text-sub text-web-ink-muted">{option.description}</Text>
                      </View>
                      <View className={`h-5 w-5 items-center justify-center rounded-full ${selected ? "bg-brand-green" : "border-2 border-web-ink-faint"}`}>
                        {selected && <Check color={colors.white} size={12} strokeWidth={3} />}
                      </View>
                    </Selectable>
                  );
                })}
              </View>
              <Button label="Calculate my targets" icon={<ArrowRight color={colors.white} size={18} />} iconPosition="right" onPress={calculate} disabled={!stats} />
            </>
          )}

          {step === "targets" && targets && (
            <>
              <View className="items-center gap-2">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-orange/15">
                  <Target color={colors.brandOrange} size={28} />
                </View>
                <Text className="text-center font-inter-semibold text-heading text-web-ink">Here are your recommended targets</Text>
                <Text className="text-center font-inter-regular text-small text-web-ink-muted">
                  Based on your stats and goal{goalLabel ? ` (${goalLabel})` : ""}
                </Text>
              </View>

              {adjusting ? (
                <View className="gap-3">
                  <StatField Icon={Flame} label="Calories (kcal per day)" value={String(targets.calories)} onChange={(t) => editTarget("calories", t)} />
                  <StatField Icon={Dumbbell} label="Protein (g)" value={String(targets.protein)} onChange={(t) => editTarget("protein", t)} />
                  <StatField Icon={Wheat} label="Carbs (g)" value={String(targets.carbs)} onChange={(t) => editTarget("carbs", t)} />
                  <StatField Icon={Droplets} label="Fat (g)" value={String(targets.fats)} onChange={(t) => editTarget("fats", t)} />
                </View>
              ) : (
                <>
                  <View className="items-center rounded-2xl bg-brand-green/5 py-4">
                    <Text className="font-inter-bold text-heading text-brand-green">{targets.calories.toLocaleString("en-PH")}</Text>
                    <Text className="font-inter-regular text-small text-web-ink-muted">kcal per day</Text>
                  </View>
                  <View className="flex-row gap-2">
                    <MacroTile Icon={Dumbbell} tint="bg-macro-protein/10" color={colors.macro.protein} value={targets.protein} label="Protein" pct={pct(targets.protein, 4)} />
                    <MacroTile Icon={Wheat} tint="bg-macro-carbs/10" color={colors.macro.carbs} value={targets.carbs} label="Carbs" pct={pct(targets.carbs, 4)} />
                    <MacroTile Icon={Droplets} tint="bg-macro-fats/10" color={colors.macro.fats} value={targets.fats} label="Fat" pct={pct(targets.fats, 9)} />
                  </View>
                </>
              )}

              <View className="flex-row items-start gap-3 rounded-xl bg-notice-bg px-3 py-2.5">
                <Lightbulb color={colors.notice.icon} size={16} />
                <Text className="flex-1 font-inter-regular text-small text-notice-text">
                  These targets will be used to find meals that fit your nutrition goal and budget.
                </Text>
              </View>

              {!adjusting && (
                <Pressable
                  onPress={() => setAdjusting(true)}
                  className="flex-row items-center justify-center gap-2 rounded-xl border border-web-divider py-3 active:bg-web-divider/40"
                >
                  <Pencil color={colors.webInk.soft} size={15} />
                  <Text className="font-inter-semibold text-body text-web-ink-soft">Adjust manually</Text>
                </Pressable>
              )}
              <Button label="Use these targets" onPress={() => onConfirm(targets, draft.goal)} disabled={targets.calories <= 0} />
              {onTurnOff && (
                <Pressable onPress={onTurnOff} hitSlop={8} className="items-center">
                  <Text className="font-inter-medium text-body text-web-ink-muted">Turn off macro goal</Text>
                </Pressable>
              )}
            </>
          )}
        </Animated.View>
      </View>
    </BottomSheet>
  );
}
