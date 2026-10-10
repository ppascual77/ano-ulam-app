import { ReactNode } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { AppText, Toggle } from "@/frontend/components/ui";

type SettingsSectionProps = {
  title: string;
  children: ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
};

// A settings group: a dotted section title ("Privacy.") in the app's
// section style, a notch under the page's "Settings.", over a bordered card
// of rows.
export function SettingsSection({ title, children, onLayout }: SettingsSectionProps) {
  return (
    <View onLayout={onLayout} className="gap-3">
      <AppText variant="sectionSubtitle" dot>
        {title}
      </AppText>
      <View className="gap-5 rounded-2xl border border-ink-emphasis/10 px-5 py-4">{children}</View>
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
        <SettingsRowLabel>{label}</SettingsRowLabel>
        <SettingsRowDescription>{description}</SettingsRowDescription>
      </View>
      <Toggle checked={value} onChange={onChange} />
    </View>
  );
}

// A row's name ("Reduce motion").
export function SettingsRowLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <Text className={`font-inter-semibold text-body-lg text-ink-emphasis ${className}`}>{children}</Text>;
}

// What the row does, under its name.
export function SettingsRowDescription({ children }: { children: ReactNode }) {
  return <Text className="mt-1 font-inter-regular text-body leading-5 text-ink-subtle">{children}</Text>;
}

// Heading for a group of controls inside a section ("Dietary focus").
export function SettingsLabel({ children }: { children: string }) {
  return <AppText variant="title">{children}</AppText>;
}
