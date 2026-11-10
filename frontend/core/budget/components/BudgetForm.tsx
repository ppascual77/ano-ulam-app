import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, Text, TextInput, View, type TextInputInstance } from "react-native";
import * as Haptics from "expo-haptics";
import { Utensils } from "lucide-react-native";
import { AppText, Button, Stepper } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { usePreferredMeals } from "@/frontend/core/meals/hooks/usePreferredMeals";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { DEFAULT_SERVINGS, parseBudget } from "../utils/budgetMatch";

type SuggestParams = { budget: string; servings: number };

type BudgetFormProps = {
  onSuggestMeals?: (params: SuggestParams) => void;
  /** Checked before suggesting (e.g. the daily limit): false skips the
   *  "thinking" and the suggestion, and the caller shows why. */
  beforeSuggest?: (params: SuggestParams) => Promise<boolean>;
};

// Forced "thinking" time before suggestions show, so the button's reel of
// dishes actually gets seen (the suggestion itself is instant).
const SUGGEST_DELAY_MS = 2000;
// One dish name per tick while the reel spins.
const REEL_TICK_MS = 110;
// Short enough that the button never grows past the card while it spins.
const REEL_MAX_CHARS = 11;
// Before the catalog loads.
const REEL_FALLBACK = ["Adobo", "Sinigang", "Tinola", "Sisig", "Kare-Kare", "Pinakbet", "Bistek", "Laing"];
// One tap amounts.
const QUICK_AMOUNTS = [150, 300, 500, 1000];
// The big number rolls to a picked amount over this long.
const ROLL_MS = 380;

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;
const clip = (s: string) => (s.length > REEL_MAX_CHARS ? `${s.slice(0, REEL_MAX_CHARS - 1)}…` : s);

// Suggest by Budget's form as one composer card: the budget as a big number
// (tap it to type), quick amounts, servings ("Para sa") and Suggest. Picking
// an amount rolls the number to it; Suggest spins dish names through the
// button like a slot reel while it "thinks". With no amount yet, Suggest
// opens the keyboard on the number instead of suggesting (so an empty
// budget never uses up a daily suggestion).
export function BudgetForm({ onSuggestMeals, beforeSuggest }: BudgetFormProps) {
  const [budget, setBudget] = useState("");
  const [servings, setServings] = useState(DEFAULT_SERVINGS);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [reelIndex, setReelIndex] = useState(0);
  const reduceMotion = useReduceMotion();
  const inputRef = useRef<TextInputInstance>(null);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const roll = useRef(0);

  const { meals } = usePreferredMeals();
  const reel = useMemo(() => {
    const names = meals.map((m) => clip(m.name)).filter(Boolean);
    return names.length >= 4 ? names : REEL_FALLBACK;
  }, [meals]);

  useEffect(
    () => () => {
      clearTimeout(timeout.current);
      cancelAnimationFrame(roll.current);
    },
    [],
  );

  // The reel: a new dish name every tick while suggesting.
  useEffect(() => {
    if (!isSuggesting || reduceMotion) return;
    const timer = setInterval(() => setReelIndex((i) => i + 1), REEL_TICK_MS);
    return () => clearInterval(timer);
  }, [isSuggesting, reduceMotion]);

  // Rolls the big number from what's there to `target` (ease-out).
  const rollTo = (target: number) => {
    cancelAnimationFrame(roll.current);
    const from = parseBudget(budget) ?? 0;
    if (reduceMotion || from === target) return setBudget(String(target));
    let start: number | null = null;
    const tick = (t: number) => {
      start ??= t;
      const u = Math.min(1, (t - start) / ROLL_MS);
      const eased = 1 - Math.pow(1 - u, 3);
      setBudget(String(Math.round(from + (target - from) * eased)));
      if (u < 1) roll.current = requestAnimationFrame(tick);
    };
    roll.current = requestAnimationFrame(tick);
  };

  const amount = parseBudget(budget);

  const handleSuggest = async () => {
    if (isSuggesting) return;
    if (amount == null) {
      inputRef.current?.focus();
      return;
    }
    // The budget's keyboard goes away as soon as it's pressed.
    Keyboard.dismiss();
    if (beforeSuggest && !(await beforeSuggest({ budget, servings }))) return;
    setIsSuggesting(true);
    timeout.current = setTimeout(() => {
      setIsSuggesting(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuggestMeals?.({ budget, servings });
    }, SUGGEST_DELAY_MS);
  };

  return (
    <View className="rounded-3xl bg-mood-bg px-5 pb-4 pt-5">
      <Text className="font-inter-semibold text-sub uppercase tracking-widest text-ink-subtle">Magkano budget?</Text>

      <Pressable onPress={() => inputRef.current?.focus()} className="mt-1 flex-row items-center" accessibilityLabel="Budget amount">
        <Text className="mr-1 font-inter-extrabold text-heading-lg text-primary">₱</Text>
        <TextInput
          ref={inputRef}
          value={budget}
          onChangeText={(text) => {
            cancelAnimationFrame(roll.current);
            setBudget(text.replace(/[^0-9]/g, ""));
          }}
          placeholder="0"
          placeholderTextColor={colors.ink.placeholder}
          selectionColor={colors.accent}
          keyboardType="number-pad"
          maxLength={5}
          className="flex-1 font-inter-extrabold text-subhero tracking-display text-ink-emphasis"
          style={{ padding: 0, fontVariant: ["tabular-nums"] }}
        />
      </Pressable>

      <View className="mt-2 flex-row flex-wrap gap-2">
        {QUICK_AMOUNTS.map((q) => {
          const on = amount === q;
          return (
            <Pressable
              key={q}
              onPress={() => {
                void Haptics.selectionAsync();
                Keyboard.dismiss();
                rollTo(q);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              className={`rounded-full border px-3.5 py-2 ${on ? "border-primary bg-primary" : "border-ink-emphasis/10 bg-white active:bg-ink-emphasis/5"}`}
            >
              <Text className={`font-inter-semibold text-small ${on ? "text-white" : "text-ink-emphasis"}`}>{peso(q)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View className="mt-4 flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <AppText variant="bodyMedium" className="text-ink-subtle">
            Para sa
          </AppText>
          <Stepper value={servings} onChange={setServings} min={1} decrementLabel="Fewer servings" incrementLabel="More servings" />
        </View>
        <Button
          label={isSuggesting && !reduceMotion ? reel[reelIndex % reel.length] : "Suggest"}
          icon={<Utensils color={colors.white} size={18} strokeWidth={2} />}
          shape="pill"
          // Reduce motion: no reel, the plain spinner while it "thinks".
          loading={isSuggesting && reduceMotion}
          loader="spiral"
          onPress={handleSuggest}
          style={{ width: 168 }}
        />
      </View>
    </View>
  );
}
