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

// Kept in sync by hand with frontend/features/onboarding/slides.ts's
// "preferenceGroups" slide — same underlying preference, two entry points.
const DIETARY_FOCUS_OPTIONS = [
  { id: "vegan", label: "Vegan" },
  { id: "vegetarian", label: "Vegetarian" },
  { id: "keto", label: "Keto" },
  { id: "pescatarian", label: "Pescatarian" },
  { id: "none", label: "None" },
  { id: "paleo", label: "Paleo" },
];

const ALLERGEN_OPTIONS = [
  { id: "nuts", label: "Nuts" },
  { id: "gluten", label: "Gluten" },
  { id: "dairy", label: "Dairy" },
  { id: "shellfish", label: "Shellfish" },
  { id: "soy", label: "Soy" },
  { id: "coconut", label: "Coconut" },
  { id: "sesame", label: "Sesame" },
  { id: "none", label: "None" },
];

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
          <AppText variant="headingMedium" className="mb-5">
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
          <AppText variant="headingMedium" className="mb-5">
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
