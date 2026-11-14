import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import * as Haptics from "expo-haptics";
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { Button, SearchBar } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { usePantry, usePantryActions } from "../hooks/usePantry";
import { usePantryStaples } from "../hooks/usePantryStaples";
import { STAPLE_GROUPS } from "../staples";
import { CountLabel } from "./CountLabel";
import { SheetHeader } from "./SheetHeader";

const EASE = Easing.out(Easing.cubic);
const AnimatedPath = Animated.createAnimatedComponent(Path);
// The check's stroke length in its 20-unit viewBox (two segments, ~4.5 +
// ~9.7), rounded up so it starts fully hidden.
const CHECK_LENGTH = 15;

// The staples' checkbox: ticking settles it from slightly smaller (eased,
// no spring) while the check mark draws itself in; unticking just clears.
// Reduce motion: the fill and check fade, no scale or drawing.
function Checkbox({ checked }: { checked: boolean }) {
  const reduce = useReduceMotion();
  const fill = useSharedValue(checked ? 1 : 0);
  const draw = useSharedValue(checked ? 1 : 0);
  const scale = useSharedValue(1);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const to = checked ? 1 : 0;
    fill.value = withTiming(to, { duration: 140 });
    if (reduce) {
      draw.value = withTiming(to, { duration: 140 });
      return;
    }
    draw.value = checked ? withTiming(1, { duration: 220, easing: EASE }) : withTiming(0, { duration: 100 });
    if (checked) {
      scale.value = 0.85;
      scale.value = withTiming(1, { duration: 180, easing: EASE });
    }
  }, [checked, reduce, fill, draw, scale]);

  const boxStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value }));
  const checkProps = useAnimatedProps(() =>
    reduce ? { strokeDashoffset: 0, opacity: draw.value } : { strokeDashoffset: CHECK_LENGTH * (1 - draw.value), opacity: 1 },
  );

  return (
    <Animated.View style={boxStyle}>
      <View className="h-6 w-6">
        <View className="absolute inset-0 rounded-md border-2 border-ink-placeholder" />
        {/* The filled box covers the gray outline when ticked (same 6px
            radius as rounded-md). */}
        <Animated.View style={[{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: 6, backgroundColor: colors.primary }, fillStyle]} />
        <Svg width="100%" height="100%" viewBox="0 0 20 20">
          <AnimatedPath
            d="M5 10.5l3.2 3.2L15 6.8"
            stroke={colors.white}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={CHECK_LENGTH}
            animatedProps={checkProps}
          />
        </Svg>
      </View>
    </Animated.View>
  );
}

// The staples as a checklist grouped by kind, all pre-checked: untick what
// you don't have. The button adds the ticked ones and removes unticked ones
// that were already in the pantry, so the list matches what was confirmed.
export function PantryStaplesView({ onBack }: { onBack: () => void }) {
  const { data: pantry = [] } = usePantry();
  const actions = usePantryActions();
  const { staples } = usePantryStaples();
  const [query, setQuery] = useState("");
  const [unchecked, setUnchecked] = useState<Set<string>>(() => new Set());

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = q ? staples.filter((s) => s.label.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) : staples;
    return STAPLE_GROUPS.map((g) => ({ ...g, items: shown.filter((s) => s.group === g.key) })).filter((g) => g.items.length > 0);
  }, [staples, query]);

  const inPantry = useMemo(() => new Set(pantry.map((p) => p.id)), [pantry]);
  const toAdd = staples.filter((s) => !unchecked.has(s.id) && !inPantry.has(s.id)).length;

  const toggle = (id: string) => {
    void Haptics.selectionAsync();
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // A group's Select all / none: none when every item is ticked, else all.
  const toggleGroup = (ids: string[]) => {
    void Haptics.selectionAsync();
    setUnchecked((prev) => {
      const next = new Set(prev);
      const allTicked = ids.every((id) => !prev.has(id));
      for (const id of ids) {
        if (allTicked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const apply = () => {
    for (const staple of staples) {
      if (unchecked.has(staple.id)) {
        if (inPantry.has(staple.id)) actions.remove(staple.id);
      } else if (!inPantry.has(staple.id)) {
        actions.add({ id: staple.id, name: staple.name });
      }
    }
    onBack();
  };

  return (
    <View className="flex-1">
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerClassName="gap-4 px-5 pb-4 pt-10">
        <SheetHeader title="Common pantry staples" subtitle="Untick what you don't have." onBack={onBack} />
        <SearchBar placeholder="Search staples…" value={query} onChangeText={setQuery} onClear={() => setQuery("")} autoCorrect={false} />

        {groups.map((group) => {
          const ids = group.items.map((s) => s.id);
          const allTicked = ids.every((id) => !unchecked.has(id));
          return (
            <View key={group.key}>
              <View className="flex-row items-center gap-2 pb-1">
                <Text className="flex-1 font-inter-bold text-sub uppercase tracking-widest text-ink-subtle">{group.label}</Text>
                <Pressable onPress={() => toggleGroup(ids)} hitSlop={8} accessibilityRole="button" className="active:opacity-60">
                  <Text className="font-inter-semibold text-small text-primary">{allTicked ? "Select none" : "Select all"}</Text>
                </Pressable>
              </View>
              {group.items.map((staple, i) => {
                const checked = !unchecked.has(staple.id);
                return (
                  <Pressable
                    key={staple.id}
                    onPress={() => toggle(staple.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    className={`flex-row items-center gap-3 py-3 ${i === group.items.length - 1 ? "" : "border-b border-ink-emphasis/5"}`}
                  >
                    <Checkbox checked={checked} />
                    <Text className="font-inter-regular text-body text-ink-emphasis">{staple.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
        {groups.length === 0 && (
          <Text className="py-6 text-center font-inter-regular text-body text-ink-subtle">No staples match “{query.trim()}”</Text>
        )}
      </ScrollView>

      <View className="px-5 pb-4 pt-2">
        {toAdd > 0 ? (
          <Button
            onPress={apply}
            accessibilityLabel={`Add ${toAdd} staples`}
            icon={<CountLabel before="Add" count={toAdd} after={toAdd === 1 ? "staple" : "staples"} tone="onPrimary" />}
          />
        ) : (
          <Button label="Done" onPress={apply} />
        )}
      </View>
    </View>
  );
}
