import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BottomSheet, Button, ChipSelect, TextField } from "@/frontend/components/ui";
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

type Draft = {
  weight: string;
  height: string;
  age: string;
  sex: Sex;
  bodyFat: string;
  goal: Goal;
  activity: Activity;
};

const EMPTY_DRAFT: Draft = { weight: "", height: "", age: "", sex: "male", bodyFat: "", goal: "maintain", activity: "moderate" };

const SEX_OPTIONS = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
];

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

function Label({ children }: { children: string }) {
  return <Text className="mb-2 font-inter-semibold text-body text-web-ink-soft">{children}</Text>;
}

function TargetTile({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <View className="flex-1 items-center rounded-2xl bg-web-divider/70 py-3">
      <Text className="font-inter-bold text-subheading text-web-ink">
        {value.toLocaleString("en-PH")}
        <Text className="font-inter-medium text-small text-web-ink-muted">{unit}</Text>
      </Text>
      <Text className="mt-0.5 font-inter-regular text-sub text-web-ink-muted">{label}</Text>
    </View>
  );
}

type MacroGoalSheetProps = {
  visible: boolean;
  /** Current targets, when editing an enabled goal. */
  initialTargets: MacroTargets | null;
  onClose: () => void;
  onConfirm: (targets: MacroTargets) => void;
};

// "Set your nutrition goal": stats, goal and activity -> recommended
// calorie/macro targets -> use them (or adjust manually first).
export function MacroGoalSheet({ visible, initialTargets, onClose, onConfirm }: MacroGoalSheetProps) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [step, setStep] = useState<"stats" | "targets">("stats");
  const [targets, setTargets] = useState<MacroTargets | null>(initialTargets);
  const [adjusting, setAdjusting] = useState(false);

  // On open: prefill remembered stats; editing an enabled goal starts on
  // its targets.
  useEffect(() => {
    if (!visible) return;
    setAdjusting(false);
    setTargets(initialTargets);
    setStep(initialTargets ? "targets" : "stats");
    AsyncStorage.getItem(STATS_KEY)
      .then((raw) => raw && setDraft({ ...EMPTY_DRAFT, ...JSON.parse(raw) }))
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

  return (
    <BottomSheet visible={visible} onClose={onClose} heightPercent={0.9}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-5 px-6 pb-10 pt-10"
      >
        <View>
          <Text className="font-inter-bold text-subheading text-web-ink">Set your nutrition goal</Text>
          <Text className="mt-1 font-inter-regular text-body text-web-ink-muted">
            We'll use your stats to create a calorie and macro target for your plan.
          </Text>
        </View>

        {step === "stats" ? (
          <Animated.View key="stats" entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)} className="gap-5">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextField label="Weight" labelPosition="outside" suffix="kg" keyboardType="decimal-pad" value={draft.weight} onChangeText={(t) => set("weight", t)} />
              </View>
              <View className="flex-1">
                <TextField label="Height" labelPosition="outside" suffix="cm" keyboardType="number-pad" value={draft.height} onChangeText={(t) => set("height", t)} />
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextField label="Age" labelPosition="outside" suffix="yrs" keyboardType="number-pad" value={draft.age} onChangeText={(t) => set("age", t)} />
              </View>
              <View className="flex-1">
                <TextField
                  label="Body fat (optional)"
                  labelPosition="outside"
                  suffix="%"
                  keyboardType="decimal-pad"
                  value={draft.bodyFat}
                  onChangeText={(t) => set("bodyFat", t)}
                />
              </View>
            </View>

            <View>
              <Label>Sex</Label>
              <ChipSelect mode="single" required options={SEX_OPTIONS} value={[draft.sex]} onChange={(v) => set("sex", (v[0] as Sex) ?? "male")} />
            </View>

            <View>
              <Label>What's your main goal?</Label>
              <ChipSelect
                mode="single"
                required
                options={GOAL_OPTIONS.map((o) => ({ id: o.value, label: o.label }))}
                value={[draft.goal]}
                onChange={(v) => set("goal", (v[0] as Goal) ?? "maintain")}
              />
            </View>

            <View>
              <Label>Activity level</Label>
              <ChipSelect
                mode="single"
                required
                options={ACTIVITY_OPTIONS.map((o) => ({ id: o.value, label: o.label }))}
                value={[draft.activity]}
                onChange={(v) => set("activity", (v[0] as Activity) ?? "moderate")}
              />
            </View>

            <Button label="See my targets" onPress={calculate} disabled={!stats} />
          </Animated.View>
        ) : (
          targets && (
            <Animated.View key="targets" entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)} className="gap-5">
              <View className="items-center rounded-2xl bg-brand-green/5 py-5">
                <Text className="font-inter-regular text-small text-web-ink-muted">Recommended</Text>
                <Text className="mt-1 font-inter-bold text-heading text-brand-green">
                  {targets.calories.toLocaleString("en-PH")} kcal / day
                </Text>
              </View>

              {adjusting ? (
                <View className="gap-3">
                  <TextField label="Calories" labelPosition="outside" suffix="kcal" keyboardType="number-pad" value={String(targets.calories)} onChangeText={(t) => editTarget("calories", t)} />
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <TextField label="Protein" labelPosition="outside" suffix="g" keyboardType="number-pad" value={String(targets.protein)} onChangeText={(t) => editTarget("protein", t)} />
                    </View>
                    <View className="flex-1">
                      <TextField label="Carbs" labelPosition="outside" suffix="g" keyboardType="number-pad" value={String(targets.carbs)} onChangeText={(t) => editTarget("carbs", t)} />
                    </View>
                    <View className="flex-1">
                      <TextField label="Fat" labelPosition="outside" suffix="g" keyboardType="number-pad" value={String(targets.fats)} onChangeText={(t) => editTarget("fats", t)} />
                    </View>
                  </View>
                </View>
              ) : (
                <View className="flex-row gap-3">
                  <TargetTile label="Protein" value={targets.protein} unit="g" />
                  <TargetTile label="Carbs" value={targets.carbs} unit="g" />
                  <TargetTile label="Fat" value={targets.fats} unit="g" />
                </View>
              )}

              <Button label="Use these targets" onPress={() => onConfirm(targets)} disabled={targets.calories <= 0} />
              <View className="flex-row justify-center gap-6">
                {!adjusting && (
                  <Pressable onPress={() => setAdjusting(true)} hitSlop={8}>
                    <Text className="font-inter-semibold text-body text-brand-green">Adjust manually</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => setStep("stats")} hitSlop={8}>
                  <Text className="font-inter-medium text-body text-web-ink-muted">Edit my stats</Text>
                </Pressable>
              </View>
            </Animated.View>
          )
        )}
      </ScrollView>
    </BottomSheet>
  );
}
