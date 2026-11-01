import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { AppText, ChipSelect } from "@/frontend/components/ui";
import type { PriceAlerts } from "@/api/auth";
import { IngredientSearch } from "@/frontend/core/meals/components/IngredientSearch";
import { PantryChip } from "@/frontend/core/pantry/components/PantryChip";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";
import { usePriceItems } from "@/frontend/core/prices/hooks/usePriceItems";
import { ProSettingSheet } from "./ProSettingSheet";
import { SettingsToggle } from "./SettingsSection";

const THRESHOLD_OPTIONS: { id: PriceAlerts["threshold"]; label: string }[] = [
  { id: "any", label: "Any price drop" },
  { id: "10pct", label: "Drops of 10% or more" },
];

// Pro: the ingredients to be told about when their price drops. A form,
// saved on Save. Alerts are in-app: a card at the top of Price Watch and a
// dot on its tab (usePriceAlerts), from DA's week-over-week prices.
export function PriceAlertsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { prefs, setPrefs } = usePreferences();
  const [draft, setDraft] = useState<PriceAlerts>(prefs.price_alerts);
  // Fresh from what's saved every time it opens (drops unsaved edits).
  useEffect(() => {
    if (visible) setDraft(prefs.price_alerts);
  }, [visible]);
  const watchedIds = useMemo(() => new Set(draft.ingredients.map((i) => i.id)), [draft.ingredients]);
  // Only ingredients with a DA price can alert: name the others.
  const { data: priceItems } = usePriceItems();
  const untracked = useMemo(() => {
    if (!priceItems) return [];
    const tracked = new Set(priceItems.flatMap((item) => (item.ingredientId ? [item.ingredientId] : [])));
    return draft.ingredients.filter((i) => !tracked.has(i.id)).map((i) => i.name.split(",")[0]);
  }, [priceItems, draft.ingredients]);

  const save = () => {
    setPrefs({ ...prefs, price_alerts: draft });
    onClose();
  };

  return (
    <ProSettingSheet
      visible={visible}
      title="Price alerts"
      subtitle="Get told when what you buy gets cheaper."
      actionLabel="Save"
      onAction={save}
      onClose={onClose}
    >
      <SettingsToggle
        label="Price alerts"
        description="Turn off to pause every alert without losing your list."
        value={draft.enabled}
        onChange={(enabled) => setDraft((prev) => ({ ...prev, enabled }))}
      />

      <View className="gap-3">
        <AppText variant="title">Ingredients to watch</AppText>
        <IngredientSearch
          placeholder="Search ingredient…"
          disabledIds={watchedIds}
          onPick={(ingredient) =>
            setDraft((prev) => ({ ...prev, ingredients: [...prev.ingredients, { id: ingredient.id, name: ingredient.canonical_name }] }))
          }
        />
        {draft.ingredients.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {draft.ingredients.map((item) => (
              <PantryChip
                key={item.id}
                item={item}
                onRemove={() => setDraft((prev) => ({ ...prev, ingredients: prev.ingredients.filter((i) => i.id !== item.id) }))}
              />
            ))}
          </View>
        ) : (
          <Text className="font-inter-regular text-small text-web-ink-muted">Nothing watched yet.</Text>
        )}
        {untracked.length > 0 && (
          <Text className="font-inter-regular text-small text-web-ink-muted">
            No DA price for {untracked.join(", ")} yet, so {untracked.length === 1 ? "it" : "they"} can&apos;t alert.
          </Text>
        )}
      </View>

      <View className="gap-3">
        <AppText variant="title">Alert me on</AppText>
        <ChipSelect
          mode="single"
          required
          options={THRESHOLD_OPTIONS}
          value={[draft.threshold]}
          onChange={(value) => setDraft((prev) => ({ ...prev, threshold: value[0] === "10pct" ? "10pct" : "any" }))}
        />
      </View>
    </ProSettingSheet>
  );
}
