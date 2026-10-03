import { ReactNode } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { Toggle } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

type SettingsSectionProps = {
  Icon: LucideIcon;
  title: string;
  children: ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
};

// Bordered card with an icon + title head row (Privacy, Notifications, ...).
export function SettingsSection({ Icon, title, children, onLayout }: SettingsSectionProps) {
  return (
    <View onLayout={onLayout} className="overflow-hidden rounded-2xl border border-web-divider">
      <View className="flex-row items-center gap-2 border-b border-web-divider bg-web-divider/40 px-5 py-4">
        <Icon color={colors.webInk.muted} size={15} />
        <Text className="font-inter-semibold text-body text-web-ink-soft">{title}</Text>
      </View>
      <View className="gap-4 px-5 py-4">{children}</View>
    </View>
  );
}

type SettingsToggleProps = {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

// Label + description on the left, switch on the right.
export function SettingsToggle({ label, description, value, onChange }: SettingsToggleProps) {
  return (
    <View className="flex-row items-center gap-4">
      <View className="flex-1">
        <Text className="font-inter-medium text-body text-web-ink">{label}</Text>
        <Text className="mt-0.5 font-inter-regular text-small text-web-ink-muted">{description}</Text>
      </View>
      <Toggle checked={value} onChange={onChange} />
    </View>
  );
}

// Small uppercase label above a group of controls ("DIETARY FOCUS").
export function SettingsLabel({ children }: { children: string }) {
  return <Text className="font-inter-semibold text-sub uppercase tracking-widest text-web-ink-muted">{children}</Text>;
}
