import { View } from "react-native";
import { SlidersVertical } from "lucide-react-native";
import {
  AppText,
  BottomSheet,
  Button,
  ChipSelect,
  NoticeBanner,
} from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { ALLERGEN_OPTIONS, DIETARY_FOCUS_OPTIONS } from "@/frontend/core/preferences/options";


type PreferencesSheetProps = {
  visible: boolean;
  onClose: () => void;
  dietaryFocus: string[];
  onDietaryFocusChange: (value: string[]) => void;
  allergens: string[];
  onAllergensChange: (value: string[]) => void;
};

// dietaryFocus/allergens are controlled by the parent, backed by the real
// profile (see MealSuggestion.tsx) — each ChipSelect change persists
// immediately, "Save Preferences" just closes the sheet.
export function PreferencesSheet({
  visible,
  onClose,
  dietaryFocus,
  onDietaryFocusChange,
  allergens,
  onAllergensChange,
}: PreferencesSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} heightPercent={0.6}>
      <View className="flex-1 px-8 pt-4 mt-6">
        <View className="gap-3 mb-4">
<AppText variant="sectionTitle" dot className="mb-5">
            Dietary Focus
          </AppText>
          <ChipSelect
            mode="single"
            options={DIETARY_FOCUS_OPTIONS}
            value={dietaryFocus}
            onChange={onDietaryFocusChange}
          />
        </View>

        <View className="mt-6 gap-3">
<AppText variant="sectionTitle" dot className="mb-5">
            Allergens
          </AppText>
          <ChipSelect
            mode="multi"
            options={ALLERGEN_OPTIONS}
            value={allergens}
            onChange={onAllergensChange}
          />
        </View>

        <View className="mb-4 mt-5">
          <NoticeBanner
            tone="positive"
            icon={<SlidersVertical color={colors.primary} size={24} />}
          >
            <AppText variant="bodyMedium" className="text-primary">
              We&apos;ll keep your preferences saved. Don&apos;t worry, you can
              change this anytime in Profile settings.
            </AppText>
          </NoticeBanner>
        </View>

        <Button label="Save Preferences" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}
