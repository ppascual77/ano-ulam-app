import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Pressable, View, type TextInputInstance } from "react-native";
import { Text, TextInput } from "@/frontend/components/ui/Text";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { GripVertical, Info, Plus, X } from "lucide-react-native";
import { AppText, NoticeBanner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { STEPS_MAX, type RecipeDraft, type StepErrors } from "../types";
import { shortName } from "../quickAdds";
import { StepHeader } from "./StepHeader";

// Vertical gap between step rows (matches the list's gap-3).
const ROW_GAP = 12;
const SHIFT_MS = 150;
// How long a press on a step's card waits before it picks the step up.
const LONG_PRESS_MS = 350;

// A light tick as a step lifts.
function liftHaptic() {
  void Haptics.selectionAsync();
}

// Drag state shared by every row (UI thread): which row is lifted, where it
// would land, how far it's been dragged, and each row's measured height
// (rows grow with multiline text, so positions can't assume a fixed size).
type DragState = {
  from: SharedValue<number>;
  to: SharedValue<number>;
  dragY: SharedValue<number>;
  heights: SharedValue<number[]>;
};

// Top offset of row `index` in the list, from the measured heights.
function offsetOf(heights: number[], index: number) {
  "worklet";
  let offset = 0;
  for (let i = 0; i < index; i++) offset += (heights[i] ?? 0) + ROW_GAP;
  return offset;
}

// Each picked ingredient's names to look for in a step's text: its short
// everyday name plus its aliases ("bawang"), as lowercase whole words.
type Mentionable = { id: string; label: string; pattern: RegExp };

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentionables(lines: RecipeDraft["ingredients"]): Mentionable[] {
  const out: Mentionable[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const ingredient = line.ingredient;
    if (!ingredient || seen.has(ingredient.id)) continue;
    seen.add(ingredient.id);
    const label = shortName(ingredient);
    const terms = [label, ...ingredient.aliases.map((a) => a.split(",")[0].trim())].filter((t) => t.length > 2);
    const body = terms.map((t) => escapeRegExp(t.toLowerCase())).join("|");
    if (body) out.push({ id: ingredient.id, label, pattern: new RegExp(`\\b(${body})s?\\b`, "i") });
  }
  return out;
}

type StepRowProps = {
  index: number;
  count: number;
  text: string;
  drag: DragState;
  mentions: Mentionable[];
  inputRef: (node: TextInputInstance | null) => void;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  onRemove: () => void;
  onDrop: (from: number, to: number) => void;
  onDragActive: (active: boolean) => void;
};

function StepRow({ index, count, text, drag, mentions, inputRef, onChangeText, onSubmit, onRemove, onDrop, onDragActive }: StepRowProps) {
  const { from, to, dragY, heights } = drag;
  const [focused, setFocused] = useState(false);

  // Two ways to pick a step up: a long press anywhere on its card, or the
  // grip right away. The card's long press is off while its text is being
  // edited, where a long press means moving the cursor. Memoized so a
  // re-render mid-drag (e.g. the screen pausing its scroll) doesn't swap in
  // a new gesture and drop its end/finalize callbacks.
  const makePan = useCallback(
    (longPress: boolean) => {
      const pan = Gesture.Pan()
        .enabled(count > 1 && !(longPress && focused))
        .onStart(() => {
          from.value = index;
          to.value = index;
          dragY.value = 0;
          scheduleOnRN(onDragActive, true);
          scheduleOnRN(liftHaptic);
        })
        .onUpdate((e) => {
          dragY.value = e.translationY;
          // Which slot the lifted row's center is over right now.
          const h = heights.value;
          const center = offsetOf(h, index) + (h[index] ?? 0) / 2 + e.translationY;
          let target = 0;
          for (let i = 0; i < count; i++) {
            if (center >= offsetOf(h, i)) target = i;
          }
          to.value = target;
        })
        .onEnd(() => {
          const start = from.value;
          const end = to.value;
          const h = heights.value;
          // Glide into the landing slot, then reorder for real. Moving down, the
          // rows in between shift up by this row's height, so its new top is
          // the target row's bottom minus its own height.
          const landing =
            offsetOf(h, end) - offsetOf(h, start) + (end > start ? (h[end] ?? 0) - (h[start] ?? 0) : 0);
          dragY.value = withTiming(landing, { duration: SHIFT_MS }, (finished) => {
            if (finished) scheduleOnRN(onDrop, start, end);
          });
        })
        .onFinalize(() => {
          scheduleOnRN(onDragActive, false);
        });
      return longPress ? pan.activateAfterLongPress(LONG_PRESS_MS) : pan;
    },
    [count, index, focused, from, to, dragY, heights, onDrop, onDragActive],
  );
  const cardPan = useMemo(() => makePan(true), [makePan]);
  const gripPan = useMemo(() => makePan(false), [makePan]);

  const rowStyle = useAnimatedStyle(() => {
    const f = from.value;
    const t = to.value;
    if (f === -1) return { transform: [{ translateY: 0 }, { scale: 1 }], zIndex: 0, opacity: 1 };
    if (index === f) {
      // The lifted row follows the finger, slightly raised.
      return { transform: [{ translateY: dragY.value }, { scale: 1.02 }], zIndex: 10, opacity: 0.95 };
    }
    // Rows between the lifted row's origin and target slide over by its
    // height to open a gap where it will land.
    const shift = (heights.value[f] ?? 0) + ROW_GAP;
    let y = 0;
    if (f < t && index > f && index <= t) y = -shift;
    else if (f > t && index >= t && index < f) y = shift;
    return { transform: [{ translateY: withTiming(y, { duration: SHIFT_MS }) }, { scale: 1 }], zIndex: 0, opacity: 1 };
  });

  // Ingredients from the list this step mentions, as quiet tags under it.
  const mentioned = text.trim() ? mentions.filter((m) => m.pattern.test(text)) : [];

  return (
    <Animated.View
      style={rowStyle}
      onLayout={(e) => {
        const next = [...heights.value];
        next[index] = e.nativeEvent.layout.height;
        heights.value = next;
      }}
    >
      <GestureDetector gesture={cardPan}>
        {/* A soft card, like the step will read when cooking: the number in a
            circle, the text at the cooking-read size (body-lg). */}
        <View
          className={`flex-row items-start gap-3 rounded-2xl border p-3 ${
            focused ? "border-primary/40 bg-white" : "border-transparent bg-ink-emphasis/5"
          }`}
        >
          <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Text className="font-inter-bold text-body-lg text-primary">{index + 1}</Text>
          </View>
          <View className="flex-1 gap-2">
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={onChangeText}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={index === 0 ? "e.g. Sauté the garlic and onion until fragrant." : "What's next?"}
              placeholderTextColor={colors.ink.placeholder}
              multiline
              // Return starts the next step instead of a new line.
              submitBehavior="submit"
              returnKeyType={index < STEPS_MAX - 1 ? "next" : "done"}
              onSubmitEditing={onSubmit}
              className="min-h-8 font-inter-regular text-body-lg text-ink"
              style={{ paddingTop: 4, paddingBottom: 4 }}
            />
            {mentioned.length > 0 && (
              <View className="flex-row flex-wrap gap-1.5">
                {mentioned.map((m) => (
                  <Animated.View key={m.id} entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)}>
                    <View className="rounded-full bg-primary/10 px-2 py-0.5">
                      <Text className="font-inter-semibold text-sub text-primary">{m.label}</Text>
                    </View>
                  </Animated.View>
                ))}
              </View>
            )}
          </View>
          <View className="items-center gap-3 pt-1.5">
            {count > 1 && (
              <Pressable onPress={onRemove} hitSlop={6} accessibilityLabel="Remove step">
                <X color={colors.ink.subtle} size={16} />
              </Pressable>
            )}
            {count > 1 && (
              <GestureDetector gesture={gripPan}>
                <View hitSlop={8} accessibilityLabel="Drag to reorder">
                  <GripVertical color={colors.ink.subtle} size={16} />
                </View>
              </GestureDetector>
            )}
          </View>
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

type StepsStepProps = {
  draft: RecipeDraft;
  onChange: (patch: Partial<RecipeDraft>) => void;
  errors: StepErrors;
  /** While a step is being dragged: the screen pauses its scrolling so the
   *  two gestures don't compete. */
  onDraggingChange?: (dragging: boolean) => void;
};

// Step 3: the cooking instructions, one numbered card per step, up to 12
// (same cap as the web). Return starts the next step (focus moves there);
// long-press a card, or drag its grip, to reorder. Ingredients from the
// list that a step mentions show as tags under it.
export function StepsStep({ draft, onChange, errors, onDraggingChange }: StepsStepProps) {
  const from = useSharedValue(-1);
  const to = useSharedValue(-1);
  const dragY = useSharedValue(0);
  const heights = useSharedValue<number[]>([]);
  const drag: DragState = { from, to, dragY, heights };

  const setSteps = (steps: string[]) => onChange({ steps });
  const mentions = useMemo(() => mentionables(draft.ingredients), [draft.ingredients]);

  // Return on step i: focus step i + 1, adding it first when i is the last.
  const inputs = useRef<(TextInputInstance | null)[]>([]);
  const focusNext = useRef<number | null>(null);
  useEffect(() => {
    if (focusNext.current == null) return;
    inputs.current[focusNext.current]?.focus();
    focusNext.current = null;
  }, [draft.steps.length]);
  const submitStep = (i: number) => {
    if (i < draft.steps.length - 1) {
      inputs.current[i + 1]?.focus();
    } else if (draft.steps.length < STEPS_MAX && draft.steps[i].trim()) {
      focusNext.current = i + 1;
      setSteps([...draft.steps, ""]);
    } else {
      inputs.current[i]?.blur();
    }
  };
  const onDragActive = useCallback((active: boolean) => onDraggingChange?.(active), [onDraggingChange]);

  // Clear the drag offsets in the same commit the new order renders in, so
  // rows don't flash back to their old spots for a frame.
  useLayoutEffect(() => {
    from.value = -1;
    to.value = -1;
    dragY.value = 0;
  }, [draft.steps, from, to, dragY]);

  // Stable (reads the latest steps from a ref) so the rows' memoized drag
  // gestures aren't rebuilt on every render.
  const latest = useRef({ steps: draft.steps, onChange });
  latest.current = { steps: draft.steps, onChange };
  const drop = useCallback(
    (start: number, end: number) => {
      if (start === end) {
        from.value = -1;
        to.value = -1;
        dragY.value = 0;
        return;
      }
      const steps = [...latest.current.steps];
      const [moved] = steps.splice(start, 1);
      steps.splice(end, 0, moved);
      latest.current.onChange({ steps });
    },
    [from, to, dragY],
  );

  return (
    <View className="gap-3">
      <View className="mb-3">
        <StepHeader title="How to cook it" subtitle="One action per step. Press return to start the next one." />
      </View>
      {draft.steps.map((step, i) => (
        <StepRow
          key={i}
          index={i}
          count={draft.steps.length}
          text={step}
          drag={drag}
          mentions={mentions}
          inputRef={(node) => {
            inputs.current[i] = node;
          }}
          onSubmit={() => submitStep(i)}
          onChangeText={(text) => setSteps(draft.steps.map((s, j) => (j === i ? text : s)))}
          onRemove={() => setSteps(draft.steps.filter((_, j) => j !== i))}
          onDrop={drop}
          onDragActive={onDragActive}
        />
      ))}

      {draft.steps.length < STEPS_MAX && (
        // Full-width dashed "add" row, gray (secondary to the steps above).
        <Pressable
          onPress={() => {
            focusNext.current = draft.steps.length;
            setSteps([...draft.steps, ""]);
          }}
          className="flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-emphasis/20 py-3 active:bg-ink-emphasis/5"
        >
          <Plus color={colors.ink.subtle} size={16} />
          <AppText variant="body" className="text-ink-subtle">
            Add step
          </AppText>
        </Pressable>
      )}
      {errors.steps && (
        <NoticeBanner icon={<Info color={colors.notice.icon} size={15} />}>
          <AppText variant="caption" className="text-notice-text">
            Almost there! Just add at least one step so others can cook it.
          </AppText>
        </NoticeBanner>
      )}
    </View>
  );
}
