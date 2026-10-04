import { ReactNode, useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import Animated, { SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
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
  Lock,
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
const SHEET_HEIGHT = 0.88;
// The back-arrow row above the steps (pt-8 + a 20px icon).
const ARROW_ROW = 52;
// Matches every step's ScrollView padding, for measuring the intro.
const STEP_PADDING = "gap-5 px-6 pb-10 pt-3";
const SLIDE_MS = 260;
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
      <Text className={`mt-1 font-inter-regular text-body text-web-ink-muted ${centered ? "px-4 text-center" : ""}`}>{body}</Text>
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

// Steps after the intro, for "Step n of 3" and the progress bar.
const PROGRESS_STEPS: Step[] = ["stats", "goal", "targets"];

function StepProgress({ step }: { step: Step }) {
  const index = PROGRESS_STEPS.indexOf(step);
  if (index < 0) return null;
  return (
    <View className="gap-2">
      <Text className="font-inter-semibold text-sub uppercase tracking-widest text-brand-green">
        Step {index + 1} of {PROGRESS_STEPS.length}
      </Text>
      <View className="flex-row gap-1.5">
        {PROGRESS_STEPS.map((s, i) => (
          <View key={s} className={`h-1 flex-1 rounded-full ${i <= index ? "bg-brand-green" : "bg-web-divider"}`} />
        ))}
      </View>
    </View>
  );
}

// One stat in the 2-column grid: icon circle, label, then a big value with
// its unit right after it. The whole tile focuses the input; the border
// turns green while typing.
function StatTile({ Icon, label, unit, value, onChange, decimal, hint }: { Icon: LucideIcon; label: string; unit: string; value: string; onChange: (v: string) => void; decimal?: boolean; hint?: string }) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={() => input.current?.focus()}
      className={`flex-1 gap-2 rounded-2xl border bg-white p-3 ${focused ? "border-brand-green" : "border-web-divider"}`}
    >
      <View className="flex-row items-center gap-2">
        <View className="h-7 w-7 items-center justify-center rounded-full bg-brand-green/10">
          <Icon color={colors.brandGreen.DEFAULT} size={14} />
        </View>
        <Text className="flex-1 font-inter-medium text-small text-web-ink-body" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View className="flex-row items-baseline gap-1">
        <TextInput
          ref={input}
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="—"
          placeholderTextColor={colors.webInk.faint}
          keyboardType={decimal ? "decimal-pad" : "number-pad"}
          maxLength={5}
          className="min-w-[28px] font-inter-bold text-heading text-web-ink"
          style={{ padding: 0 }}
        />
        <Text className="font-inter-medium text-body text-web-ink-muted">{unit}</Text>
      </View>
      {hint && <Text className="font-inter-regular text-sub text-web-ink-muted">{hint}</Text>}
    </Pressable>
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

// Step 1: what setting a goal gets you. Also rendered invisibly to measure
// its natural height (the sheet fits this step, see MacroGoalSheet).
function IntroStep({ onStart }: { onStart: () => void }) {
  return (
    <>
      <Title centered title="Set your nutrition goal" body="We'll use your stats to calculate your daily calorie and macro targets for a more personalized meal plan." />
      <View className="gap-6 rounded-2xl bg-brand-green/5 px-4 py-6">
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
      <Button label="Get Started" icon={<ArrowRight color={colors.white} size={18} />} iconPosition="right" onPress={onStart} />
    </>
  );
}

// Step 3: main goal + activity level. The tallest step, so it also sets the
// sheet's height for every step after the intro (measured invisibly).
type GoalStepProps = {
  goal: Goal;
  activity: Activity;
  onGoal: (goal: Goal) => void;
  onActivity: (activity: Activity) => void;
  onCalculate: () => void;
  canCalculate: boolean;
};

function GoalStep({ goal, activity, onGoal, onActivity, onCalculate, canCalculate }: GoalStepProps) {
  return (
    <>
      <Text className="font-inter-semibold text-heading text-web-ink">What's your main goal?</Text>
      <View className="flex-row gap-2">
        {GOAL_OPTIONS.map((option) => {
          const Icon = GOAL_ICONS[option.value];
          const selected = goal === option.value;
          return (
            <Selectable key={option.value} selected={selected} onPress={() => onGoal(option.value)} className="flex-1 items-center gap-1.5 px-2 py-3">
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
          const selected = activity === option.value;
          return (
            <Selectable key={option.value} selected={selected} onPress={() => onActivity(option.value)} className="flex-row items-center gap-3 px-4 py-3">
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
      <Button label="Calculate my targets" icon={<ArrowRight color={colors.white} size={18} />} iconPosition="right" onPress={onCalculate} disabled={!canCalculate} />
    </>
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
  // Which way the next step slides: "none" on open (the sheet's own rise
  // covers it), "forward" from the right, "back" from the left.
  const [direction, setDirection] = useState<"none" | "forward" | "back">("none");
  // Direction first, step on the next frame: the outgoing step re-renders
  // with the new direction, so it exits the right way (its exit animation
  // is read from its last render).
  const go = (next: Step, dir: "forward" | "back") => {
    setDirection(dir);
    requestAnimationFrame(() => setStep(next));
  };
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [targets, setTargets] = useState<MacroTargets | null>(initialTargets);
  const [adjusting, setAdjusting] = useState(false);

  // On open: prefill remembered stats; editing an enabled goal starts on
  // its targets.
  useEffect(() => {
    if (!visible) return;
    setAdjusting(false);
    setTargets(initialTargets);
    setDirection("none");
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
    go("targets", "forward");
  };

  const editTarget = (key: keyof MacroTargets, text: string) =>
    setTargets((prev) => (prev ? { ...prev, [key]: Math.round(num(text)) || 0 } : prev));

  const back = PREVIOUS[step];

  // Sheet height: the intro fits its content; every later step shares the
  // goal step's height (the tallest) so swiping between them doesn't
  // resize the sheet. Going
  // intro <-> stats, the content area animates between the two heights in
  // step with the swipe.
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxHeight = windowHeight * SHEET_HEIGHT - ARROW_ROW - insets.bottom;
  // Later steps: as tall as the goal step (the tallest), within the max.
  const [goalHeight, setGoalHeight] = useState(0);
  const fixedHeight = goalHeight > 0 ? Math.min(goalHeight, maxHeight) : maxHeight;
  const [introHeight, setIntroHeight] = useState(0);
  const targetHeight = step === "intro" && introHeight > 0 ? Math.min(introHeight, fixedHeight) : fixedHeight;
  const contentHeight = useSharedValue(targetHeight);
  useEffect(() => {
    contentHeight.value = direction === "none" ? targetHeight : withTiming(targetHeight, { duration: SLIDE_MS });
  }, [targetHeight]);
  const contentStyle = useAnimatedStyle(() => ({ height: contentHeight.value }));
  const goalLabel = GOAL_OPTIONS.find((o) => o.value === draft.goal)?.label;
  const pct = (grams: number, kcalPerGram: number) => (targets && targets.calories > 0 ? Math.round(((grams * kcalPerGram) / targets.calories) * 100) : 0);

  return (
    // fitContent: the sheet follows the content area's (animated) height.
    <BottomSheet visible={visible} onClose={onClose} heightPercent={SHEET_HEIGHT} fitContent>
      {/* Back arrow from the second step on; close by swiping down or tapping outside. */}
      <View className="flex-row items-center px-5 pt-8">
        {back && (
          <Pressable onPress={() => go(back, "back")} hitSlop={10} accessibilityLabel="Back">
            <ArrowLeft color={colors.webInk.DEFAULT} size={20} />
          </Pressable>
        )}
      </View>

      {/* Invisible copies of the intro and goal steps, only to measure
          their natural heights. */}
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, opacity: 0 }}>
        <View className={STEP_PADDING} onLayout={(e) => setIntroHeight(e.nativeEvent.layout.height)}>
          <IntroStep onStart={() => {}} />
        </View>
      </View>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, opacity: 0 }}>
        <View className={STEP_PADDING} onLayout={(e) => setGoalHeight(e.nativeEvent.layout.height)}>
          <StepProgress step="goal" />
          <GoalStep goal={draft.goal} activity={draft.activity} onGoal={() => {}} onActivity={() => {}} onCalculate={() => {}} canCalculate />
        </View>
      </View>

      <Animated.View style={contentStyle} className="overflow-hidden">
        {/* Keyed by step: each step fades in. */}
        <Animated.View
          key={step}
          entering={direction === "forward" ? SlideInRight.duration(SLIDE_MS) : direction === "back" ? SlideInLeft.duration(SLIDE_MS) : undefined}
          exiting={direction === "back" ? SlideOutRight.duration(SLIDE_MS) : SlideOutLeft.duration(SLIDE_MS)}
          className="absolute inset-0"
        >
        <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false} contentContainerClassName={STEP_PADDING}>
          <StepProgress step={step} />
          {step === "intro" && <IntroStep onStart={() => go("stats", "forward")} />}

          {step === "stats" && (
            <>
              <Title title="Your stats" body="This helps us calculate your calorie and macro targets." />
              <View className="gap-3">
                <View className="flex-row gap-3">
                  <StatTile Icon={Scale} label="Weight" unit="kg" value={draft.weight} onChange={(v) => set("weight", v)} decimal />
                  <StatTile Icon={Ruler} label="Height" unit="cm" value={draft.height} onChange={(v) => set("height", v)} />
                </View>
                <View className="flex-row gap-3">
                  <StatTile Icon={Calendar} label="Age" unit="yrs" value={draft.age} onChange={(v) => set("age", v)} />
                  <StatTile Icon={Percent} label="Body fat" unit="%" value={draft.bodyFat} onChange={(v) => set("bodyFat", v)} decimal hint="Optional" />
                </View>

                {/* Segmented control: a soft track with the selected half raised. */}
                <View className="flex-row rounded-2xl bg-web-divider/70 p-1">
                  {(["male", "female"] as Sex[]).map((sex) => {
                    const selected = draft.sex === sex;
                    return (
                      <Pressable
                        key={sex}
                        onPress={() => set("sex", sex)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        className={`flex-1 items-center rounded-xl py-2.5 ${selected ? "bg-white shadow-sm" : ""}`}
                      >
                        <Text className={`font-inter-semibold text-body ${selected ? "text-brand-green" : "text-web-ink-muted"}`}>
                          {sex === "male" ? "Male" : "Female"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="flex-row items-center justify-center gap-1.5">
                <Lock color={colors.webInk.muted} size={12} />
                <Text className="font-inter-regular text-small text-web-ink-muted">Only used to calculate your targets.</Text>
              </View>

              <Button label="Continue" icon={<ArrowRight color={colors.white} size={18} />} iconPosition="right" onPress={() => go("goal", "forward")} disabled={!stats} />
            </>
          )}

          {step === "goal" && (
            <GoalStep goal={draft.goal} activity={draft.activity} onGoal={(g) => set("goal", g)} onActivity={(v) => set("activity", v)} onCalculate={calculate} canCalculate={!!stats} />
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
        </ScrollView>
        </Animated.View>
      </Animated.View>
    </BottomSheet>
  );
}
