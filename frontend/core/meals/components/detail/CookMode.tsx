import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, View, useWindowDimensions, type FlatListInstance } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { StatusBar } from "expo-status-bar";
import { canKeepAwake } from "../../nativeFeatures";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { ChevronLeft, ChevronRight, ChevronUp, ShoppingBasket, X } from "lucide-react-native";
import { AppText, BottomSheet, Button, DotLabel } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { capitalize } from "../../utils/dietary";
import { cookIngredientGroups, findMentions, shortMealName, splitStep, type StepSegment } from "../../utils/cookStep";
import type { IngredientType } from "../../mealTypes";
import { usePantry } from "@/frontend/core/pantry/hooks/usePantry";
import { useLaterPlanNeeds } from "@/frontend/core/pantry/hooks/usePlanPantryNeeds";
import { useCookedStore } from "@/frontend/core/pantry/store/useCookedStore";
import { buildUsedUpGroups, type UsedUpGroup } from "@/frontend/core/pantry/usedUp";
import { UsedUpSheet } from "@/frontend/core/pantry/components/UsedUpSheet";

const EASE = Easing.out(Easing.cubic);

function ProgressSegment({ filled }: { filled: boolean }) {
  const fill = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    fill.value = withTiming(filled ? 1 : 0, { duration: 250, easing: EASE });
  }, [filled]);
  const style = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View className="h-1 flex-1 overflow-hidden rounded-full bg-ink-emphasis/10">
      <Animated.View style={[{ height: "100%", borderRadius: 999, backgroundColor: colors.primary }, style]} />
    </View>
  );
}

// A step's text with the words that name an ingredient highlighted. Amounts
// live in the All ingredients list, not in the step. Each word is its own
// piece (so a highlight can be drawn and animated behind it); words that run
// together ("garlic,") stay one unit so they wrap together, and the space
// inside a multi-word ingredient ("soy sauce") keeps the highlight going.
type Piece = { text: string; highlighted: boolean };

function toUnits(segments: StepSegment[]): Piece[][] {
  const units: Piece[][] = [[]];
  const add = (piece: Piece) => {
    const unit = units[units.length - 1];
    const prev = unit[unit.length - 1];
    if (prev && prev.highlighted === piece.highlighted) prev.text += piece.text;
    else unit.push({ ...piece });
  };
  for (const segment of segments) {
    const parts = segment.text.split(/(\s+)/);
    parts.forEach((part, k) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        // Between two words of the same ingredient: the highlight continues.
        if (segment.keys && k > 0 && k < parts.length - 1) add({ text: " ", highlighted: true });
        else add({ text: " ", highlighted: false });
        units.push([]);
      } else {
        add({ text: part, highlighted: !!segment.keys });
      }
    });
  }
  return units.filter((unit) => unit.length > 0);
}

// Highlights sweep in from the right, all of a step's at once, on a smooth
// ease-in-out bezier (no overshoot); with Reduce motion they fade in.
const HIGHLIGHT_EASING = Easing.bezier(0.65, 0, 0.35, 1);
const HIGHLIGHT_DURATION = 650;
const HIGHLIGHT_DELAY = 150;

function Highlight({ progress, reduceMotion }: { progress: SharedValue<number>; reduceMotion: boolean }) {
  const style = useAnimatedStyle(() =>
    reduceMotion ? { opacity: progress.value } : { transform: [{ scaleX: progress.value }] },
  );
  return (
    // Position and color in style, not className: NativeWind classes don't
    // reach an animated view's style here (theme.ts's tintedBg is for
    // exactly this).
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: 0,
          right: 0,
          top: 2,
          bottom: 2,
          borderRadius: 2,
          backgroundColor: colors.tintedBg,
          transformOrigin: "right",
        },
        style,
      ]}
    />
  );
}

function StepText({
  segments,
  textClass,
  progress,
  reduceMotion,
}: {
  segments: StepSegment[];
  textClass: string;
  progress: SharedValue<number>;
  reduceMotion: boolean;
}) {
  const units = toUnits(segments);
  return (
    <View className="mt-4 flex-row flex-wrap" accessible accessibilityLabel={segments.map((s) => s.text).join("")}>
      {units.map((unit, u) => (
        <View key={u} className="flex-row">
          {unit.map((piece, p) =>
            piece.highlighted ? (
              <View key={p}>
                <Highlight progress={progress} reduceMotion={reduceMotion} />
                <Text className={`${textClass} text-ink-emphasis`}>{piece.text}</Text>
              </View>
            ) : (
              <Text key={p} className={textClass}>
                {piece.text}
              </Text>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

type Page = { lead: StepSegment[]; detail: StepSegment[] | null };

function StepPage({ page, number, active, width, reduceMotion }: { page: Page; number: number; active: boolean; width: number; reduceMotion: boolean }) {
  // 0 -> 1 each time this step comes into view; back to 0 once it's left.
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = active
      ? withDelay(HIGHLIGHT_DELAY, withTiming(1, { duration: reduceMotion ? 250 : HIGHLIGHT_DURATION, easing: HIGHLIGHT_EASING }))
      : 0;
  }, [active, reduceMotion]);
  return (
    // Sits high rather than centered, so a short step doesn't float in empty
    // space; scrolls if a long one at the largest text size runs past the
    // footer.
    <ScrollView style={{ width }} contentContainerClassName="px-7 pb-8 pt-10" showsVerticalScrollIndicator={false}>
      <DotLabel>{`Step ${number}`}</DotLabel>
      {/* The first sentence as the headline, read from arm's length; the
          rest a size down. */}
      <StepText segments={page.lead} textClass="font-inter-bold text-heading leading-8 text-ink-emphasis" progress={progress} reduceMotion={reduceMotion} />
      {page.detail && (
        <StepText segments={page.detail} textClass="font-inter-regular text-subheading leading-7 text-ink" progress={progress} reduceMotion={reduceMotion} />
      )}
    </ScrollView>
  );
}

type CookModeProps = {
  /** The catalog meal: marks it cooked (Home's nudge skips it) and leaves
   *  out its own spot when checking what later planned meals need. */
  mealId?: string;
  mealName: string;
  steps: string[];
  /** Already scaled to `servings` (see scaleIngredient). */
  ingredients: IngredientType[];
  servings: number;
  onClose: () => void;
};

// "Start cooking" from meal details: one step at a time, large enough to
// read from the counter, swipe or tap Next to move on. The screen stays
// awake while it's open. Rendered over the meal page (inside the same
// sheet), so the meal is right where it was on close.
const KEEP_AWAKE_TAG = "cook-mode";

export function CookMode({ mealId, mealName, steps, ingredients, servings, onClose }: CookModeProps) {
  // The screen stays on while cooking. Loaded lazily: expo-keep-awake throws
  // on import in a build without it (see nativeFeatures.ts).
  useEffect(() => {
    if (!canKeepAwake) return;
    const KeepAwake = require("expo-keep-awake") as typeof import("expo-keep-awake");
    void KeepAwake.activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => void KeepAwake.deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
  }, []);
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const list = useRef<FlatListInstance>(null);
  const last = index === steps.length - 1;

  // Done on the last step: "Anything used up?" when the meal used anything
  // in the pantry, then out. Later plans load once the last step is near.
  const [usedUpOpen, setUsedUpOpen] = useState(false);
  // BottomSheet reports "closed" once on mount too; only a real close leaves.
  const usedUpShown = useRef(false);
  // Frozen when it opens, so rows don't vanish as the pantry updates.
  const [usedUpRows, setUsedUpRows] = useState<UsedUpGroup[]>([]);
  const { data: pantry = [] } = usePantry();
  const { needs } = useLaterPlanNeeds(mealId, index >= steps.length - 2);
  const usedUpGroups = useMemo(
    () => buildUsedUpGroups([{ key: mealName, name: shortMealName(mealName), ingredients }], pantry, needs),
    [mealName, ingredients, pantry, needs],
  );
  const finish = () => {
    if (mealId) useCookedStore.getState().markCooked(mealId);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (usedUpGroups.length > 0) {
      usedUpShown.current = true;
      setUsedUpRows(usedUpGroups);
      setUsedUpOpen(true);
    }
    else onClose();
  };

  // Each step split into its headline and the rest, with the ingredient
  // words found once up front.
  const { groups, pages } = useMemo(() => {
    const { groups, terms } = cookIngredientGroups(ingredients);
    const qtyByKey = new Map(groups.flatMap((g) => g.items.map((it) => [it.key, it.qty] as const)));
    const pages = steps.map((step) => {
      const { lead, detail } = splitStep(step);
      const { parts, mentioned } = findMentions(detail ? [lead, detail] : [lead], terms, qtyByKey);
      return { lead: parts[0], detail: parts[1] ?? null, mentioned };
    });
    return { groups, pages };
  }, [steps, ingredients]);
  const itemCount = groups.reduce((n, g) => n + g.items.length, 0);
  const mentioned = pages[index]?.mentioned ?? new Set<string>();

  // A light tick each time the step changes (swipe or button).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void Haptics.selectionAsync();
  }, [index]);

  const goTo = (i: number) => {
    const target = Math.max(0, Math.min(steps.length - 1, i));
    list.current?.scrollToIndex({ index: target, animated: !reduceMotion });
    setIndex(target);
  };

  const openList = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setListOpen(true);
  };

  return (
    <Animated.View
      entering={reduceMotion ? FadeIn.duration(200) : SlideInDown.duration(320).easing(EASE)}
      exiting={reduceMotion ? FadeOut.duration(150) : SlideOutDown.duration(260).easing(EASE)}
      className="absolute inset-0 bg-white"
      style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }}
    >
      <StatusBar style="dark" />
      <View className="flex-row items-center gap-3 px-5">
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityLabel="Close cook mode"
          className="h-10 w-10 items-center justify-center rounded-full bg-ink-emphasis/5"
        >
          <X color={colors.ink.emphasis} size={20} />
        </Pressable>
        <View className="flex-1">
          <Text numberOfLines={1} className="font-inter-semibold text-body text-ink-emphasis">
            {shortMealName(mealName)}
          </Text>
          <Text className="font-inter-regular text-small text-ink-subtle">
            Step {index + 1} of {steps.length}
          </Text>
        </View>
      </View>
      <View className="mt-4 flex-row gap-1.5 px-5">
        {steps.map((_, i) => (
          <ProgressSegment key={i} filled={i <= index} />
        ))}
      </View>

      <FlatList
        ref={list}
        data={pages}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        className="flex-1"
        extraData={index}
        renderItem={({ item, index: i }) => (
          <StepPage page={item} number={i + 1} active={i === index} width={width} reduceMotion={reduceMotion} />
        )}
      />

      <View className="gap-3 px-5 pt-2">
        {itemCount > 0 && (
          <Pressable
            onPress={openList}
            accessibilityRole="button"
            accessibilityLabel={`All ingredients, ${itemCount} items`}
            className="flex-row items-center gap-3 rounded-2xl border border-primary/10 bg-white px-3.5 py-3 active:bg-primary/5"
          >
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-tinted-bg">
              <ShoppingBasket color={colors.primary} size={18} />
            </View>
            <View className="flex-1">
              <Text className="font-inter-semibold text-body text-ink-emphasis">All ingredients</Text>
              <Text className="font-inter-regular text-small text-ink-subtle">
                {itemCount} items · for {servings} {servings === 1 ? "serving" : "servings"}
              </Text>
            </View>
            <ChevronUp color={colors.ink.subtle} size={18} />
          </Pressable>
        )}
        <View className="flex-row items-center gap-3">
          <Button
            variant="muted"
            shape="circle"
            icon={<ChevronLeft color={colors.ink.emphasis} size={22} />}
            accessibilityLabel="Previous step"
            onPress={() => goTo(index - 1)}
            disabled={index === 0}
          />
          <View className="flex-1">
            <Button
              label={last ? "Done" : "Next step"}
              icon={last ? undefined : <ChevronRight color={colors.white} size={18} />}
              iconPosition="right"
              onPress={() => (last ? finish() : goTo(index + 1))}
            />
          </View>
        </View>
      </View>

      {/* The full list in recipe order, nothing moved or filtered out.
          Lines the step's text names share its highlight; that says what
          the text names, not everything the step needs. */}
      <BottomSheet visible={listOpen} onClose={() => setListOpen(false)} presentation="inline" fitContent heightPercent={0.8}>
        <View className="px-6 pb-4 pt-10">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <AppText variant="sectionTitle" dot>
                Ingredients
              </AppText>
              <Text className="mt-0.5 font-inter-regular text-body text-ink-subtle">
                For {servings} {servings === 1 ? "serving" : "servings"}
              </Text>
            </View>
            <Pressable
              onPress={() => setListOpen(false)}
              hitSlop={10}
              accessibilityLabel="Close ingredients"
              className="h-9 w-9 items-center justify-center rounded-full bg-ink-emphasis/5"
            >
              <X color={colors.ink.emphasis} size={16} />
            </Pressable>
          </View>
          {mentioned.size > 0 && (
            <View className="mt-3 flex-row items-center gap-2">
              <View className="h-2 w-3.5 rounded-sm bg-tinted-bg" />
              <Text className="font-inter-regular text-small text-ink-subtle">Highlighted: named in step {index + 1}'s text</Text>
            </View>
          )}
          <View className="mt-2">
            {groups.map((group, gi) => (
              <View key={gi}>
                {group.section && (
                  <Text className="mb-1 mt-4 px-3 font-inter-semibold text-body text-ink-subtle">{group.section}</Text>
                )}
                {group.items.map((item) => {
                  const named = mentioned.has(item.key);
                  return (
                    // Named in the step: the name and amount carry the step
                    // text's highlight (nested Text, so it sits behind the
                    // words only).
                    <View key={item.key} className="flex-row items-center justify-between gap-4 px-3 py-3">
                      <Text className="flex-1 font-inter-medium text-body-lg text-ink-emphasis">
                        <Text className={named ? "bg-tinted-bg" : ""}>{capitalize(item.name)}</Text>
                      </Text>
                      <Text className="text-body">
                        <Text className={named ? "bg-tinted-bg font-inter-semibold text-ink-emphasis" : "font-inter-regular text-ink-subtle"}>
                          {item.qty}
                        </Text>
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </BottomSheet>

      <UsedUpSheet visible={usedUpOpen} onClose={() => setUsedUpOpen(false)} onClosed={() => usedUpShown.current && onClose()} groups={usedUpRows} presentation="inline" />
    </Animated.View>
  );
}
