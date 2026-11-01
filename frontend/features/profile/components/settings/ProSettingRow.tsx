import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { ChevronRight, Lock } from "lucide-react-native";
import { Toggle } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { ProBadge } from "@/frontend/core/pro/components/ProBadge";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { SettingsRowDescription, SettingsRowLabel } from "./SettingsSection";

type ProSettingRowProps = {
  label: string;
  /** What it does (not set yet), or a summary of what's set. */
  description: string;
  /** Without Pro: a lock, and the row opens the upsell instead. */
  locked: boolean;
  onPress: () => void;
  /** Position in the list: unlocking (or locking) ripples down the rows. */
  index?: number;
  /** Shown instead of the description line (e.g. chips of what's set). */
  detail?: ReactNode;
  /** An on/off setting: a switch instead of the chevron (with Pro). */
  toggle?: { value: boolean; onChange: (value: boolean) => void };
};

// One row in Settings > Pro: name with the PRO badge, a line under it, and a
// chevron (or a lock without Pro); an on/off setting has a switch instead. When Pro turns on or off, the lock and
// chevron crossfade, one row after another.
export function ProSettingRow({ label, description, locked, onPress, index = 0, toggle, detail }: ProSettingRowProps) {
  const reduceMotion = useReduceMotion();
  const enter = reduceMotion ? undefined : FadeIn.delay(index * 60).duration(220);
  const exit = reduceMotion ? undefined : FadeOut.duration(120);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="flex-row items-center gap-3 active:opacity-60">
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <SettingsRowLabel>{label}</SettingsRowLabel>
          <ProBadge />
        </View>
        {detail ?? <SettingsRowDescription>{description}</SettingsRowDescription>}
      </View>
      {toggle && !locked ? (
        <Animated.View key="toggle" entering={enter} exiting={exit}>
          <Toggle checked={toggle.value} onChange={toggle.onChange} />
        </Animated.View>
      ) : (
        <View className="h-5 w-5 items-center justify-center">
          {locked ? (
            <Animated.View key="lock" entering={enter} exiting={exit}>
              <Lock color={colors.ink.subtle} size={16} />
            </Animated.View>
          ) : (
            <Animated.View key="open" entering={enter} exiting={exit}>
              <ChevronRight color={colors.ink.subtle} size={18} />
            </Animated.View>
          )}
        </View>
      )}
    </Pressable>
  );
}
