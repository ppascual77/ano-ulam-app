import { ReactNode, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BottomSheet } from "@/frontend/components/ui";
import {
  DIETARY_OPTIONS,
  EMPTY_FILTERS,
  MEAL_STYLE_OPTIONS,
  PRICE_MAX,
  PRICE_MIN,
  RESTAURANT_OPTIONS,
  SORT_OPTIONS,
  countFilters,
  finalizeFilters,
  isPriceUnlocked,
  type FilterOption,
  type MealFilters,
} from "../utils/filters";
import { PriceRangeSlider } from "./PriceRangeSlider";

type ListKey = "tags" | "dietaryTags" | "restaurants";

function BlockLabel({ children }: { children: string }) {
  return <Text className="mb-3 font-inter-semibold text-sub uppercase tracking-widest text-web-ink-muted">{children}</Text>;
}

// Checkbox or radio tile in the 2-column option grid.
function OptionTile({ label, selected, kind, onPress }: { label: string; selected: boolean; kind: "check" | "radio"; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={kind === "check" ? "checkbox" : "radio"}
      accessibilityState={{ checked: selected }}
      className="flex-row items-center gap-3 rounded-lg border border-web-divider bg-white px-4 py-3 active:bg-web-divider/50"
      style={{ width: "48.5%" }}
    >
      {kind === "check" ? (
        <View
          className={`h-5 w-5 items-center justify-center rounded-sm border ${selected ? "border-brand-green bg-brand-green" : "border-web-ink-muted"}`}
        >
          {selected && <Text className="font-inter-bold text-small text-white">✓</Text>}
        </View>
      ) : (
        <View className={`h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? "border-brand-green" : "border-web-ink-muted"}`}>
          {selected && <View className="h-2.5 w-2.5 rounded-full bg-brand-green" />}
        </View>
      )}
      <Text className="shrink font-inter-medium text-small text-web-ink-soft">{label}</Text>
    </Pressable>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <View className="flex-row flex-wrap justify-between gap-y-2">{children}</View>;
}

type FilterSheetProps = {
  visible: boolean;
  onClose: () => void;
  applied: MealFilters;
  onApply: (filters: MealFilters) => void;
};

// Browse filters. Edits go to a draft (loaded from the applied filters on
// open, discarded on close). Apply commits and closes; Clear all commits
// the empty filters right away and stays open, like the web.
export function FilterSheet({ visible, onClose, applied, onApply }: FilterSheetProps) {
  const [draft, setDraft] = useState<MealFilters>(applied);

  useEffect(() => {
    if (visible) setDraft(applied);
    // Only on open: later applied changes come from this sheet itself.
  }, [visible]);

  const toggleIn = (key: ListKey, value: string) =>
    setDraft((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((v) => v !== value) : [...prev[key], value],
    }));

  const unlocked = isPriceUnlocked(draft);
  const count = countFilters(draft);

  const renderChecks = (key: ListKey, options: FilterOption[]) => (
    <Grid>
      {options.map((option) => (
        <OptionTile
          key={option.value}
          kind="check"
          label={option.label}
          selected={draft[key].includes(option.value)}
          onPress={() => toggleIn(key, option.value)}
        />
      ))}
    </Grid>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} heightPercent={0.9} fitContent>
      <View className="gap-5 px-6 pb-8 pt-10">
        <View className="flex-row items-center justify-between">
          <Text className="font-inter-semibold text-body text-web-ink-soft">Filters</Text>
          {count > 0 && (
            <Pressable
              onPress={() => {
                setDraft(EMPTY_FILTERS);
                onApply(EMPTY_FILTERS);
              }}
              hitSlop={8}
              className="active:opacity-70"
            >
              <Text className="font-inter-medium text-small text-brand-green">Clear all</Text>
            </Pressable>
          )}
        </View>

        <View>
          <BlockLabel>Price Range</BlockLabel>
          {unlocked ? (
            <PriceRangeSlider
              value={draft.priceRange ?? [PRICE_MIN, PRICE_MAX]}
              onChange={(priceRange) => setDraft((prev) => ({ ...prev, priceRange }))}
            />
          ) : (
            <Text className="font-inter-regular text-sub leading-5 text-web-ink-muted">
              Select at least one Meal Style, Dietary Focus, or Restaurant filter to narrow by price.
            </Text>
          )}
        </View>

        <View>
          <BlockLabel>Sort by Price</BlockLabel>
          <Grid>
            {SORT_OPTIONS.map((option) => (
              <OptionTile
                key={option.value}
                kind="radio"
                label={option.label}
                selected={draft.sortByPrice === option.value}
                // Tapping the selected one again clears it.
                onPress={() =>
                  setDraft((prev) => ({ ...prev, sortByPrice: prev.sortByPrice === option.value ? null : option.value }))
                }
              />
            ))}
          </Grid>
        </View>

        <View>
          <BlockLabel>Meal Style</BlockLabel>
          {renderChecks("tags", MEAL_STYLE_OPTIONS)}
        </View>

        <View>
          <BlockLabel>Dietary Focus</BlockLabel>
          {renderChecks("dietaryTags", DIETARY_OPTIONS)}
        </View>

        <View>
          <BlockLabel>Fast Food Restaurant</BlockLabel>
          {renderChecks("restaurants", RESTAURANT_OPTIONS)}
        </View>

        <Pressable
          onPress={() => {
            onApply(finalizeFilters(draft));
            onClose();
          }}
          disabled={count === 0}
          className={`items-center rounded-lg bg-brand-green py-3 ${count === 0 ? "opacity-70" : ""}`}
        >
          <Text className="font-inter-semibold text-body text-white">
            {count === 0 ? "Apply Filters" : `Apply ${count} filter${count === 1 ? "" : "s"}`}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
