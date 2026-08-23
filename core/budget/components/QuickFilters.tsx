import { Pressable, Text, View } from "react-native";
import { Beef, Drumstick, Fish, Ham, Leaf, X } from "lucide-react-native";
import { AppText } from "@/components/ui";
import { colors } from "@/constants/theme";
import { MACRO_PILLS_CONFIG, NON_NUTRITION_PILLS_CONFIG } from "@/core/meals/utils/constants";

const PROTEIN_TYPE_FILTERS = [
  { id: "chicken", label: "Chicken", icon: Drumstick, color: "#CA8A04" },
  { id: "pork", label: "Pork", icon: Ham, color: "#DB2777" },
  { id: "beef", label: "Beef", icon: Beef, color: "#DC2626" },
  { id: "seafood", label: "Seafood", icon: Fish, color: "#0EA5E9" },
  { id: "veggie", label: "Veggie", icon: Leaf, color: "#16A34A" },
];

// Reuse the exact icon/color/label already defined for these pills
// (getMealPills) instead of re-inventing a second definition of "Quick" etc.
function tagFilter(id: string, pill: { label: string; bgColor: string; icon: typeof PROTEIN_TYPE_FILTERS[number]["icon"] }) {
  return { id, label: pill.label, color: pill.bgColor, icon: pill.icon };
}

const TAG_FILTERS = [
  tagFilter("highProtein", MACRO_PILLS_CONFIG.highProtein),
  tagFilter("quick", NON_NUTRITION_PILLS_CONFIG.quick),
  tagFilter("lowCarb", MACRO_PILLS_CONFIG.lowCarb),
];

const FILTERS = [...PROTEIN_TYPE_FILTERS, ...TAG_FILTERS];

type QuickFiltersProps = {
  /** The active budget amount, shown as a dismissible leading chip. */
  budgetLabel?: string;
  onClearBudget?: () => void;
  selected: string[];
  onChange: (selected: string[]) => void;
};

export function QuickFilters({ budgetLabel, onClearBudget, selected, onChange }: QuickFiltersProps) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  return (
    <View className="gap-2">
      <AppText variant="title">Quick Filters</AppText>
      <View className="flex-row flex-wrap items-center gap-2">
        {budgetLabel && (
          <View className="flex-row items-center gap-1.5 rounded-full bg-primary py-1.5 pl-3 pr-2">
            <Text className="font-inter-semibold text-caption text-white">₱{budgetLabel}</Text>
            <Pressable onPress={onClearBudget} hitSlop={8}>
              <X color={colors.white} size={12} />
            </Pressable>
          </View>
        )}

        {FILTERS.map((filter) => {
          const isSelected = selected.includes(filter.id);
          const Icon = filter.icon;
          return (
            <Pressable
              key={filter.id}
              onPress={() => toggle(filter.id)}
              className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{
                backgroundColor: isSelected ? filter.color : colors.white,
                borderWidth: 1,
                borderColor: filter.color,
              }}
            >
              <Icon color={isSelected ? colors.white : filter.color} size={13} />
              <Text
                className="font-inter-medium text-caption"
                style={{ color: isSelected ? colors.white : filter.color }}
              >
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
