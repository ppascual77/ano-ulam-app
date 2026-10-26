import { Pressable, View } from "react-native";
import { ChevronRight, Lock } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { ProBadge } from "@/frontend/core/pro/components/ProBadge";
import { SettingsRowDescription, SettingsRowLabel } from "./SettingsSection";

type ProSettingRowProps = {
  label: string;
  /** What it does (not set yet), or a summary of what's set. */
  description: string;
  /** Without Pro: a lock, and the row opens the upsell instead. */
  locked: boolean;
  onPress: () => void;
};

// One row in Settings > Pro: name with the PRO badge, a line under it, and a
// chevron (or a lock without Pro).
export function ProSettingRow({ label, description, locked, onPress }: ProSettingRowProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="flex-row items-center gap-3 active:opacity-60">
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <SettingsRowLabel>{label}</SettingsRowLabel>
          <ProBadge />
        </View>
        <SettingsRowDescription>{description}</SettingsRowDescription>
      </View>
      {locked ? <Lock color={colors.ink.subtle} size={16} /> : <ChevronRight color={colors.ink.subtle} size={18} />}
    </Pressable>
  );
}
