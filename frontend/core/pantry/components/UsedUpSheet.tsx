import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Text } from "@/frontend/components/ui/Text";
import { AppText, BottomSheet, Button, showGlobalToast } from "@/frontend/components/ui";
import { CheckBox } from "@/frontend/core/grocery/components/GroceryRow";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { usePantryActions } from "../hooks/usePantry";
import type { UsedUpGroup } from "../usedUp";

type UsedUpSheetProps = {
  visible: boolean;
  /** `updated`: Update pantry was tapped (Skip, a drag down: false). */
  onClose: (updated: boolean) => void;
  onClosed?: () => void;
  groups: UsedUpGroup[];
  /** "inline" over another sheet (Cook mode sits inside meal details). */
  presentation?: "modal" | "inline";
};

// Rows fade up one after another, this far apart (capped).
const STAGGER_MS = 35;
const STAGGER_MAX = 8;

// "Anything used up?": after Start Cooking and from Home's morning nudge.
// The defaults do the thinking (main ingredients the meal finished are
// ticked; basics, packs with some left and things a later meal needs are
// not), so most of the time it's one tap on Update pantry.
export function UsedUpSheet({ visible, onClose, onClosed, groups, presentation = "modal" }: UsedUpSheetProps) {
  const reduceMotion = useReduceMotion();
  const pantryActions = usePantryActions();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  // Fresh defaults each time it opens.
  useEffect(() => {
    if (visible) setChecked(new Set(groups.flatMap((g) => g.rows.filter((r) => r.checked).map((r) => r.id))));
  }, [visible]);

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const update = () => {
    const removed = groups.flatMap((g) => g.rows).filter((r) => checked.has(r.id));
    if (removed.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      pantryActions.removeMany(removed.map((r) => r.id));
      showGlobalToast({
        tone: "success",
        message: removed.length === 1 ? `${removed[0].name} taken out of your pantry` : `${removed.length} items taken out of your pantry`,
        action: {
          label: "Undo",
          inSheet: true,
          onPress: () => pantryActions.addMany(removed.map(({ id, name }) => ({ id, name }))),
        },
      });
    }
    onClose(true);
  };

  let index = 0;
  return (
    <BottomSheet visible={visible} onClose={() => onClose(false)} onClosed={onClosed} presentation={presentation} fitContent heightPercent={0.85}>
      <View className="px-6 pb-6 pt-10">
        <AppText variant="sectionTitle" dot>
          Anything used up?
        </AppText>
        <Text className="mt-1 font-inter-regular text-body text-ink-subtle">We&apos;ll take these out of your pantry.</Text>

        {groups.map((group) => (
          <View key={group.title} className="mt-4">
            <Text className="px-2 pb-0.5 font-inter-bold text-sub uppercase tracking-wide text-ink-subtle">{group.title}</Text>
            {group.rows.map((row) => {
              const on = checked.has(row.id);
              const delay = Math.min(index++, STAGGER_MAX) * STAGGER_MS;
              return (
                <Animated.View key={row.id} entering={reduceMotion ? undefined : FadeInDown.duration(220).delay(delay)}>
                  <Pressable
                    onPress={() => toggle(row.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={row.note ? `${row.name}, ${row.note}` : row.name}
                    className="min-h-11 flex-row items-center gap-3 rounded-xl px-2 py-2.5 active:bg-primary/5"
                  >
                    <CheckBox checked={on} />
                    <View className="flex-1">
                      <Text className="font-inter-semibold text-body text-ink-emphasis">{row.name}</Text>
                      {row.note && <Text className="font-inter-medium text-small text-accent">{row.note}</Text>}
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        ))}

        {/* Plain Animated.View, classes on the inner View: NativeWind can
            knock out Reanimated's animated values. */}
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(200).delay(120)}>
          <View className="mt-6 flex-row gap-3">
            <View className="flex-1">
              <Button variant="muted" label="Skip" onPress={() => onClose(false)} />
            </View>
            <View style={{ flex: 2 }}>
              <Button label={checked.size > 0 ? `Update pantry · ${checked.size}` : "Keep everything"} onPress={update} />
            </View>
          </View>
        </Animated.View>
      </View>
    </BottomSheet>
  );
}
