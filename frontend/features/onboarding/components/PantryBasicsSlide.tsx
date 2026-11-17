import { View } from "react-native";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Check, Plus } from "lucide-react-native";
import { AppText, PulsePressable, RollingText } from "@/frontend/components/ui";
import { Text } from "@/frontend/components/ui/Text";
import { colors } from "@/frontend/constants/theme";
import { PANTRY_STAPLES, STAPLE_GROUPS, type StapleGroup } from "@/frontend/core/pantry/staples";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { HighlightedText } from "./HighlightedText";
import type { PantryBasicsSlideData } from "../slides";

// Each shelf's picture (the same art as the ingredient categories).
const SHELF_ART: Record<StapleGroup, number> = {
  sauces: require("@/assets/icons/oil-icon.png"),
  seasonings: require("@/assets/icons/spices-icon.png"),
  aromatics: require("@/assets/icons/vegetable.icon.png"),
};

type Props = {
  slide: PantryBasicsSlideData;
  width: number;
  /** The ticked basics, by label. */
  selected: string[];
  onChange: (selected: string[]) => void;
};

// One basic as a check chip: ticked reads "I have this" (green fill and a
// check), unticked "out of it" (plain, a faint plus to add it back).
function BasicChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const reduceMotion = useReduceMotion();
  return (
    <PulsePressable
      pulse="subtle"
      radius={999}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${label}, ${on ? "have it" : "out of it"}`}
      className={`flex-row items-center gap-1.5 rounded-full border py-2 pl-2 pr-3.5 ${on ? "border-primary/30 bg-primary/10" : "border-ink-emphasis/10 bg-white"}`}
    >
      <View className={`h-5 w-5 items-center justify-center rounded-full ${on ? "bg-primary" : "bg-ink-emphasis/5"}`}>
        {on ? (
          <Animated.View key="on" entering={reduceMotion ? undefined : FadeIn.duration(160)}>
            <Check color={colors.white} size={12} strokeWidth={3} />
          </Animated.View>
        ) : (
          <Plus color={colors.ink.placeholder} size={12} strokeWidth={2.5} />
        )}
      </View>
      <Text className={`font-inter-semibold text-body ${on ? "text-primary" : "text-ink-subtle"}`}>{label}</Text>
    </PulsePressable>
  );
}

// "In your kitchen": the basics most Filipino kitchens already have, ticked
// for you, on three shelves. The count up top rolls as you tick, so it reads
// as taking stock rather than filling in a form. What stays ticked goes to
// the pantry, so the grocery list doesn't ask you to buy soy sauce on day
// one.
export function PantryBasicsSlide({ slide, width, selected, onChange }: Props) {
  const reduceMotion = useReduceMotion();
  const count = selected.length;
  const total = PANTRY_STAPLES.length;
  const all = count === total;
  const toggle = (label: string) => {
    Haptics.selectionAsync();
    onChange(selected.includes(label) ? selected.filter((l) => l !== label) : [...selected, label]);
  };

  return (
    <View style={{ width }} className="flex-1 px-8">
      <View className="flex-1 justify-center">
        <AppText variant="subhero" className="tracking-display" dot>
          {slide.title}
        </AppText>
        <HighlightedText className="mt-2">{slide.subtitle}</HighlightedText>

        {/* Taking stock: how many are at home, and one tap for all. */}
        <View className="mt-6 flex-row items-end justify-between">
          <View className="flex-row items-baseline gap-1.5">
            <RollingText value={count} rank={count} className="font-inter-extrabold text-heading-lg tracking-display text-primary" />
            <Text className="font-inter-medium text-body text-ink-subtle">of {total} at home</Text>
          </View>
          <PulsePressable
            pulse="subtle"
            onPress={() => {
              Haptics.selectionAsync();
              onChange(all ? [] : PANTRY_STAPLES.map((s) => s.label));
            }}
            accessibilityRole="button"
            className="py-1"
          >
            <Text className="font-inter-semibold text-small text-primary">{all ? "Untick all" : "Tick all"}</Text>
          </PulsePressable>
        </View>

        <View className="mt-3 gap-3">
          {STAPLE_GROUPS.map((group) => {
            const labels = PANTRY_STAPLES.filter((s) => s.group === group.key).map((s) => s.label);
            const have = labels.filter((l) => selected.includes(l)).length;
            return (
              <View key={group.key} className="rounded-2xl bg-mood-bg p-3">
                <View className="mb-2.5 flex-row items-center gap-2">
                  <Image source={SHELF_ART[group.key]} style={{ width: 22, height: 22 }} contentFit="contain" />
                  <Text className="flex-1 font-inter-bold text-body text-ink-emphasis">{group.label}</Text>
                  <Animated.View key={have} entering={reduceMotion ? undefined : FadeIn.duration(200)} exiting={reduceMotion ? undefined : FadeOut.duration(120)}>
                    <Text className="font-inter-semibold text-small text-ink-subtle">
                      {have}/{labels.length}
                    </Text>
                  </Animated.View>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {labels.map((label) => (
                    <BasicChip key={label} label={label} on={selected.includes(label)} onPress={() => toggle(label)} />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <Text className="mb-3 text-center font-inter-regular text-small text-ink-subtle">
        {count === 0 ? "Nothing ticked. Add basics anytime in Profile." : "These go to your pantry. Change them anytime in Profile."}
      </Text>
    </View>
  );
}
