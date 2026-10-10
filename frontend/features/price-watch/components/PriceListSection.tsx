import { Pressable, Text, View } from "react-native";
import { TrendingDown } from "lucide-react-native";
import { AppText, SearchBar } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { PriceItem } from "@/frontend/core/prices/utils/prices";
import { PriceRow } from "./PriceRow";

const SKELETON_ROWS = 8;

type PriceListSectionProps = {
  title: string;
  items: PriceItem[];
  loading: boolean;
  search: string;
  onSearch: (q: string) => void;
  sortByDrop: boolean;
  onToggleSort: () => void;
  onSelect: (item: PriceItem) => void;
};

export function PriceListSection({
  title,
  items,
  loading,
  search,
  onSearch,
  sortByDrop,
  onToggleSort,
  onSelect,
}: PriceListSectionProps) {
  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between">
        <AppText variant="title">{title}</AppText>
        <Pressable
          onPress={onToggleSort}
          accessibilityRole="switch"
          accessibilityState={{ checked: sortByDrop }}
          accessibilityLabel="Sort by biggest price drop"
          className={`flex-row items-center gap-1 rounded-full border px-3 py-1 ${
            sortByDrop ? "border-primary/30 bg-primary/10" : "border-ink-emphasis/10 bg-ink-emphasis/5"
          }`}
        >
          <TrendingDown color={sortByDrop ? colors.primary : colors.ink.placeholder} size={12} />
          <Text className={`font-inter-medium text-small ${sortByDrop ? "text-primary" : "text-ink-subtle"}`}>
            Biggest drop
          </Text>
        </Pressable>
      </View>

      <View className="mb-3">
        <SearchBar
          placeholder="Search ingredients..."
          value={search}
          onChangeText={onSearch}
          onClear={() => onSearch("")}
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {loading ? (
        Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <View key={i} className="mb-2 h-14 rounded-2xl bg-ink-emphasis/5" />
        ))
      ) : items.length === 0 ? (
        <AppText variant="caption" className="py-8 text-center">
          No ingredients found.
        </AppText>
      ) : (
        items.map((item) => <PriceRow key={item.id} item={item} onPress={() => onSelect(item)} />)
      )}
    </View>
  );
}
