import { Pressable, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";
import { AppText } from "@/frontend/components/ui";
import { Text } from "@/frontend/components/ui/Text";
import { colors } from "@/frontend/constants/theme";
import { PANTRY_STAPLES, STAPLE_GROUPS } from "@/frontend/core/pantry/staples";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { HighlightedText } from "./HighlightedText";
import type { PantryBasicsSlideData } from "../slides";

type Props = {
  slide: PantryBasicsSlideData;
  width: number;
  /** The ticked basics, by label. */
  selected: string[];
  onChange: (selected: string[]) => void;
};

// A square check box: filled green with a check when ticked, a plain
// outline when not. The check fades in; nothing pops.
function Box({ on }: { on: boolean }) {
  const reduceMotion = useReduceMotion();
  return (
    <View
      className={`h-5 w-5 items-center justify-center rounded-md border-2 ${on ? "border-primary bg-primary" : "border-ink-emphasis/20 bg-white"}`}
    >
      {on && (
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(140)}>
          <Check color={colors.white} size={13} strokeWidth={3.2} />
        </Animated.View>
      )}
    </View>
  );
}

// One basic: a check box and its name, half the panel wide.
function Row({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      className="min-h-11 w-1/2 flex-row items-center gap-2.5 pr-2 active:opacity-60"
    >
      <Box on={on} />
      <Text numberOfLines={1} className={`shrink font-inter-medium text-body ${on ? "text-ink-emphasis" : "text-ink-subtle"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

// "In your kitchen": the basics most Filipino kitchens already have, ticked
// for you, as a plain checklist in one panel (three labeled groups, two
// columns, hairlines between). What stays ticked goes to the pantry, so the
// grocery list doesn't ask you to buy soy sauce on day one.
export function PantryBasicsSlide({ slide, width, selected, onChange }: Props) {
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

        <View className="mt-7 flex-row items-center justify-between px-1">
          <Text className="font-inter-medium text-small text-ink-subtle">
            {count} of {total} selected
          </Text>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              onChange(all ? [] : PANTRY_STAPLES.map((s) => s.label));
            }}
            hitSlop={10}
            accessibilityRole="button"
            className="active:opacity-60"
          >
            <Text className="font-inter-semibold text-small text-primary">{all ? "Clear all" : "Select all"}</Text>
          </Pressable>
        </View>

        <View className="mt-2 rounded-2xl border border-ink-emphasis/10 bg-white px-4">
          {STAPLE_GROUPS.map((group, i) => {
            const labels = PANTRY_STAPLES.filter((s) => s.group === group.key).map((s) => s.label);
            return (
              <View key={group.key} className={`py-3 ${i > 0 ? "border-t border-ink-emphasis/5" : ""}`}>
                <Text className="mb-1 font-inter-bold text-sub uppercase tracking-wide text-ink-placeholder">{group.label}</Text>
                <View className="flex-row flex-wrap">
                  {labels.map((label) => (
                    <Row key={label} label={label} on={selected.includes(label)} onPress={() => toggle(label)} />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <Text className="mb-3 text-center font-inter-regular text-small text-ink-subtle">
        {count === 0 ? "Nothing selected. Add basics anytime in Profile." : "These go to your pantry. Change them anytime in Profile."}
      </Text>
    </View>
  );
}
