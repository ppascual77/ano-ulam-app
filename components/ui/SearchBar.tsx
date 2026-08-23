import { TextInput, TextInputProps, View } from "react-native";
import { Search } from "lucide-react-native";
import { colors } from "@/constants/theme";

type SearchBarProps = Omit<TextInputProps, "placeholder"> & {
  placeholder?: string;
  className?: string;
};

// Fixed h-14 matches Button's "circle" shape (w-14 h-14), so a SearchBar
// sits flush height-wise next to a circular icon button (e.g. a filter
// trigger) in a flex-row.
export function SearchBar({
  placeholder = "Search meals, ingredients, restaurants...",
  className = "",
  ...props
}: SearchBarProps) {
  return (
    <View
      className={`h-14 flex-row items-center gap-2 rounded-full border border-ink-emphasis/10 px-4 ${className}`}
    >
      <Search color={colors.ink.subtle} size={18} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.ink.subtle}
        className="flex-1 font-inter-regular text-body text-ink-emphasis"
        style={{ padding: 0 }}
        {...props}
      />
    </View>
  );
}
