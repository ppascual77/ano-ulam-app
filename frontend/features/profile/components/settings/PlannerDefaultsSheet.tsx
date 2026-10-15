import { useEffect, useState } from "react";
import { View } from "react-native";
import { PhilippinePeso } from "lucide-react-native";
import { AppText, ChipSelect, SegmentedSwitch, Stepper, TextField } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { PlannerDefaults, PlannerSlot } from "@/api/auth";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";
import { ProSettingSheet } from "./ProSettingSheet";
import { SettingsToggle } from "./SettingsSection";

const SLOT_OPTIONS: { id: PlannerSlot; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "merienda", label: "Merienda" },
];

const DAY_OPTIONS = [
  { value: "5", label: "5 days" },
  { value: "7", label: "7 days" },
];

type Draft = Omit<PlannerDefaults, "weekly_budget"> & { budget: string };

const toDraft = (d: PlannerDefaults): Draft => ({ ...d, budget: d.weekly_budget?.toString() ?? "" });

// Pro: what the Meal Planner starts from. A form, saved on Save (not acted
// on anywhere yet).
export function PlannerDefaultsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { prefs, setPrefs } = usePreferences();
  const [draft, setDraft] = useState<Draft>(() => toDraft(prefs.planner_defaults));
  // Fresh from what's saved every time it opens (drops unsaved edits).
  useEffect(() => {
    if (visible) setDraft(toDraft(prefs.planner_defaults));
  }, [visible]);
  const set = (patch: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...patch }));

  const save = () => {
    const budget = Number(draft.budget.replace(/,/g, ""));
    const { budget: _budget, ...rest } = draft;
    setPrefs({
      ...prefs,
      planner_defaults: { ...rest, weekly_budget: Number.isFinite(budget) && budget > 0 ? Math.round(budget) : null },
    });
    onClose();
  };

  return (
    <ProSettingSheet
      visible={visible}
      title="Meal Planner defaults"
      subtitle="What every new weekly plan starts with."
      actionLabel="Save"
      onAction={save}
      onClose={onClose}
    >
      <TextField
        label="Weekly budget"
        labelPosition="outside"
        icon={<PhilippinePeso color={colors.ink.subtle} size={16} />}
        value={draft.budget}
        onChangeText={(budget) => set({ budget })}
        keyboardType="number-pad"
      />

      <View className="flex-row items-center justify-between">
        <AppText variant="title">People</AppText>
        <Stepper
          value={draft.people}
          onChange={(people) => set({ people })}
          min={1}
          max={12}
          decrementLabel="Fewer people"
          incrementLabel="More people"
        />
      </View>

      <View className="gap-3">
        <AppText variant="title">Meals to plan</AppText>
        <ChipSelect
          mode="multi"
          required
          options={SLOT_OPTIONS}
          value={draft.slots}
          onChange={(slots) => set({ slots: slots as PlannerSlot[] })}
        />
      </View>

      <View className="gap-3">
        <AppText variant="title">Plan length</AppText>
        <View className="self-start">
          <SegmentedSwitch
            size="md"
            options={DAY_OPTIONS}
            value={String(draft.days)}
            onChange={(value) => set({ days: value === "7" ? 7 : 5 })}
          />
        </View>
      </View>

      <SettingsToggle
        label="Plan ahead automatically"
        description="Have next week's plan ready when you open the planner on or after Sunday."
        value={draft.auto_plan}
        onChange={(auto_plan) => set({ auto_plan })}
      />
    </ProSettingSheet>
  );
}
