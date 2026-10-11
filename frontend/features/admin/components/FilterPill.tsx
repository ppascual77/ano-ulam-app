import { View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { AppText, Dropdown } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

type Props = {
  label: string;
  value: string | undefined;
  options: { id: string; label: string }[];
  onChange: (value: string | undefined) => void;
};

// Compact dropdown filter — a pill showing the current selection that opens
// a Dropdown menu with an "All" option to clear it.
export function FilterPill({ label, value, options, onChange }: Props) {
  const selectedLabel = options.find((o) => o.id === value)?.label ?? `All ${label}`;

  return (
    <Dropdown
      trigger={
        // Tinted green while a filter is set, like the app's selected chips.
        <View
          className={`flex-row items-center gap-1 rounded-full border px-3 py-2 ${
            value ? "border-primary/30 bg-primary/10" : "border-ink-emphasis/10"
          }`}
        >
          <AppText variant="caption" className={value ? "font-inter-semibold text-primary" : ""}>
            {selectedLabel}
          </AppText>
          <ChevronDown color={value ? colors.primary : colors.ink.subtle} size={14} />
        </View>
      }
      items={[
        { label: `All ${label}`, onPress: () => onChange(undefined) },
        ...options.map((o) => ({ label: o.label, onPress: () => onChange(o.id) })),
      ]}
    />
  );
}
