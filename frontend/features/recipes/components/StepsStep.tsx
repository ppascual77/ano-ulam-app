import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { GripVertical, Info, Plus, X } from "lucide-react-native";
import { AppText, NoticeBanner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { STEPS_MAX, type RecipeDraft, type StepErrors } from "../types";

// Vertical gap between step rows (matches the list's gap-3).
const ROW_GAP = 12;
const SHIFT_MS = 150;

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

type StepRowProps = {
  index: number;
  count: number;
  text: string;
  drag: DragState;
  onChangeText: (text: string) => void;
  onRemove: () => void;
  onDrop: (from: number, to: number) => void;
  onDragActive: (active: boolean) => void;
};

function StepRow({ index, count, text, drag, onChangeText, onRemove, onDrop, onDragActive }: StepRowProps) {
  const { from, to, dragY, heights } = drag;

  // Pan on the grip handle only, so typing in the box still works normally.
  // Memoized so a re-render mid-drag (e.g. the screen pausing its scroll)
  // doesn't swap in a new gesture and drop its end/finalize callbacks.
  const pan = useMemo(() => Gesture.Pan()
    .enabled(count > 1)
    .onStart(() => {
      from.value = index;
      to.value = index;
      dragY.value = 0;
      scheduleOnRN(onDragActive, true);
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
    }), [count, index, from, to, dragY, heights, onDrop, onDragActive]);

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

  return (
    <Animated.View
      style={rowStyle}
      onLayout={(e) => {
        const next = [...heights.value];
        next[index] = e.nativeEvent.layout.height;
        heights.value = next;
      }}
      className="flex-row items-start gap-2 bg-white"
    >
      {/* Grip, number and remove each sit in a box the height of the input's
          first line (h-12 = its min height), centered, so they line up with
          each other and with the text however tall the step grows. */}
      <GestureDetector gesture={pan}>
        <View hitSlop={8} className={`h-12 justify-center ${count > 1 ? "" : "opacity-30"}`} accessibilityLabel="Drag to reorder">
          <GripVertical color={colors.ink.subtle} size={18} />
        </View>
      </GestureDetector>
      <View className="h-12 w-6 items-center justify-center">
        <AppText variant="heading" className="text-primary">
          {index + 1}
        </AppText>
      </View>
      <TextInput
        value={text}
        onChangeText={onChangeText}
        placeholder={index === 0 ? "e.g. Sauté the garlic and onion until fragrant." : "Next step"}
        placeholderTextColor={colors.ink.placeholder}
        multiline
        className="min-h-12 flex-1 rounded-xl border border-ink-emphasis/10 px-3 py-2.5 font-inter-regular text-body text-ink"
      />
      {count > 1 && (
        <Pressable onPress={onRemove} hitSlop={6} className="h-12 justify-center" accessibilityLabel="Remove step">
          <X color={colors.ink.subtle} size={16} />
        </Pressable>
      )}
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

// Step 3: the cooking instructions, one numbered step per box, up to 12
// (same cap as the web). Drag a step by its grip to reorder.
export function StepsStep({ draft, onChange, errors, onDraggingChange }: StepsStepProps) {
  const from = useSharedValue(-1);
  const to = useSharedValue(-1);
  const dragY = useSharedValue(0);
  const heights = useSharedValue<number[]>([]);
  const drag: DragState = { from, to, dragY, heights };

  const setSteps = (steps: string[]) => onChange({ steps });
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
      {draft.steps.map((step, i) => (
        <StepRow
          key={i}
          index={i}
          count={draft.steps.length}
          text={step}
          drag={drag}
          onChangeText={(text) => setSteps(draft.steps.map((s, j) => (j === i ? text : s)))}
          onRemove={() => setSteps(draft.steps.filter((_, j) => j !== i))}
          onDrop={drop}
          onDragActive={onDragActive}
        />
      ))}

      {draft.steps.length < STEPS_MAX && (
        // Full-width dashed "add" row, gray (secondary to the steps above).
        <Pressable
          onPress={() => setSteps([...draft.steps, ""])}
          className="flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-ink-emphasis/20 py-3 active:bg-ink-emphasis/5"
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
