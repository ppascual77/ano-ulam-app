import type { ReactNode } from "react";
import { Pressable, TextInputProps, View } from "react-native";
import { TextInput } from "./Text";
import { CircleX, Search } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

type SearchBarProps = Omit<TextInputProps, "placeholder"> & {
  placeholder?: string;
  className?: string;
  /** Shows a clear (x) button while there's text; it should empty the
   *  value (same as deleting all the text). */
  onClear?: () => void;
  /** Inside the pill's right end, after a thin divider (e.g. Browse's filter
   *  button), so search and its options read as one control. */
  trailing?: ReactNode;
};

// Fixed h-14 matches Button's "circle" shape (w-14 h-14), so a SearchBar
// sits flush height-wise next to a circular icon button (e.g. a filter
// trigger) in a flex-row.
export function SearchBar({
  placeholder = "Search meals, ingredients, restaurants...",
  className = "",
  onClear,
  trailing,
  ...props
}: SearchBarProps) {
  return (
    <View
      className={`h-14 flex-row items-center gap-2 rounded-full border border-ink-emphasis/10 ${trailing ? "pl-4 pr-1.5" : "px-4"} ${className}`}
    >
      <Search color={colors.ink.subtle} size={18} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.ink.placeholder}
        className="flex-1 font-inter-regular text-body text-ink-emphasis"
        style={{ padding: 0 }}
        {...props}
      />
      {onClear && !!props.value && (
        <Pressable onPress={onClear} hitSlop={8} accessibilityLabel="Clear search">
          <CircleX color={colors.ink.placeholder} size={16} />
        </Pressable>
      )}
      {trailing && (
        <>
          <View className="h-6 w-px bg-ink-emphasis/10" />
          {trailing}
        </>
      )}
    </View>
  );
}
