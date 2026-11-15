import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, View, useWindowDimensions, type FlatListInstance } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { StatusBar } from "expo-status-bar";
import { canKeepAwake } from "../../nativeFeatures";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, FadeIn, FadeOut, SlideInDown, SlideOutDown, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { ChevronLeft, ChevronRight, ChevronUp, ShoppingBasket, X } from "lucide-react-native";
import { AppText, BottomSheet, Button, DotLabel } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { capitalize } from "../../utils/dietary";
import { cookIngredientGroups, findMentions, shortMealName, splitStep, type StepSegment } from "../../utils/cookStep";
import type { IngredientType } from "../../mealTypes";

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

// A step's text with the words that name an ingredient softly highlighted,
// and that ingredient's amount (for the servings picked) right after its
// first mention. Nested Text, so it wraps like the rest of the sentence.
function StepText({ segments, className }: { segments: StepSegment[]; className: string }) {
  return (
    <Text className={className}>
      {segments.map((s, i) =>
        s.keys ? (
          <Text key={i}>
            <Text className="bg-tinted-bg text-ink-emphasis">{s.text}</Text>
            {s.amount ? <Text className="font-inter-bold text-body text-primary">{` ${s.amount}`}</Text> : null}
          </Text>
        ) : (
          s.text
        ),
      )}
    </Text>
  );
}

type CookModeProps = {
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

export function CookMode({ mealName, steps, ingredients, servings, onClose }: CookModeProps) {
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
        renderItem={({ item, index: i }) => (
          // Sits high rather than centered, so a short step doesn't float
          // in empty space; scrolls if a long one at the largest text size
          // runs past the footer.
          <ScrollView style={{ width }} contentContainerClassName="px-7 pb-8 pt-10" showsVerticalScrollIndicator={false}>
            <DotLabel>{`Step ${i + 1}`}</DotLabel>
            {/* The first sentence as the headline, read from arm's length;
                the rest a size down. */}
            <StepText segments={item.lead} className="mt-4 font-inter-bold text-heading leading-8 text-ink-emphasis" />
            {item.detail && <StepText segments={item.detail} className="mt-4 font-inter-regular text-subheading leading-7 text-ink" />}
          </ScrollView>
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
              onPress={() => (last ? onClose() : goTo(index + 1))}
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
                    <View
                      key={item.key}
                      className={`flex-row items-center justify-between gap-4 rounded-xl px-3 py-3 ${named ? "bg-tinted-bg/50" : ""}`}
                    >
                      <Text className="flex-1 font-inter-medium text-body-lg text-ink-emphasis">{capitalize(item.name)}</Text>
                      <Text className={`text-body ${named ? "font-inter-bold text-primary" : "font-inter-regular text-ink-subtle"}`}>
                        {item.qty}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </BottomSheet>
    </Animated.View>
  );
}
