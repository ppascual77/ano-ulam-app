import { Pressable, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import type { GroceryItem } from "../utils/buildGroceryList";

export const formatPeso = (n: number, decimals = 2) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

type GroceryRowProps = {
  item: GroceryItem;
  checked: boolean;
  onToggle: () => void;
  isLast: boolean;
  /** Full list: names wrap instead of truncating. */
  wrap?: boolean;
  /** Full list: the item is already in the user's pantry. */
  have?: boolean;
};

// Checkbox, name with Main/Pantry tag, then qty and price on the right.
// Checked items fade and get struck through.
export function GroceryRow({ item, checked, onToggle, isLast, wrap = false, have = false }: GroceryRowProps) {
  const isMain = item.category === "main";
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className={`flex-row items-center gap-3 py-3 ${isLast ? "" : "border-b border-web-divider"}`}
    >
      <View
        className={`h-[18px] w-[18px] items-center justify-center rounded-[5px] border-2 ${
          checked ? "border-brand-green bg-brand-green" : "border-web-ink-faint bg-white"
        }`}
      >
        {checked && <Check color={colors.white} size={12} strokeWidth={3} />}
      </View>

      <View className={`flex-1 flex-row items-center gap-2 ${checked ? "opacity-40" : ""}`}>
        {have && (
          <View className="rounded-full bg-brand-green px-1.5 py-0.5">
            <Text className="font-inter-semibold text-sub text-white">Have</Text>
          </View>
        )}
        <Text
          numberOfLines={wrap ? undefined : 1}
          className={`shrink font-inter-medium text-small text-web-ink-soft ${checked ? "line-through" : ""}`}
        >
          {item.name}
        </Text>
        <View className={`rounded-full px-1.5 py-0.5 ${isMain ? "bg-brand-green/10" : "bg-web-divider"}`}>
          <Text className={`font-inter-semibold text-sub ${isMain ? "text-brand-green" : "text-web-ink-muted"}`}>
            {isMain ? "Main" : "Pantry"}
          </Text>
        </View>
      </View>

      <View className={`items-end ${checked ? "opacity-40" : ""}`}>
        <Text className="font-inter-regular text-small text-web-ink-muted">{item.qty}</Text>
        {isMain && item.price > 0 && (
          <Text className="font-inter-medium text-small text-web-ink-body">~₱{formatPeso(item.price)}</Text>
        )}
      </View>
    </Pressable>
  );
}
