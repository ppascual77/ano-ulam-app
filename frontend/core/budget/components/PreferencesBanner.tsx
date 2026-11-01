import { useState } from "react";
import { Text } from "react-native";
import { Sparkles } from "lucide-react-native";
import { AppText, NoticeBanner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";
import { ActivePreferencesSummary } from "./ActivePreferencesSummary";
import { PreferencesSheet } from "./PreferencesSheet";

type PreferencesBannerProps = {
  /** Control the sheet from outside (e.g. an empty state's "Change
   *  preferences"). Omitted: the banner opens and closes it itself. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Only the Active Preferences summary, once any is set: no "Personalize
   *  your meal suggestions" prompt (Home). */
  onlyWhenSet?: boolean;
};

// The user's dietary focus and allergens, where meals are suggested (Home
// and Suggest by Budget's results): "Personalize your meal suggestions"
// until any is set, then the Active Preferences summary. Either opens the
// preferences sheet. Saved to the account (usePreferences), so every list
// that filters by them updates as soon as they change.
export function PreferencesBanner({ open: controlledOpen, onOpenChange, onlyWhenSet = false }: PreferencesBannerProps) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const setOpen = onOpenChange ?? setOwnOpen;

  const { prefs, setPrefs } = usePreferences();
  const dietaryFocus = prefs.dietary_focus !== "none" ? [prefs.dietary_focus] : [];
  const allergens = prefs.allergens;
  const hasPreferences = dietaryFocus.length > 0 || allergens.length > 0;

  return (
    <>
      {/* The sheet below stays mounted either way, so clearing every
          preference from inside it (onlyWhenSet) doesn't close it mid-edit. */}
      {hasPreferences ? (
        <ActivePreferencesSummary dietaryFocus={dietaryFocus} allergens={allergens} onManage={() => setOpen(true)} />
      ) : onlyWhenSet ? null : (
        <NoticeBanner icon={<Sparkles color={colors.notice.icon} size={15} />}>
          <AppText variant="caption" className="text-notice-text">
            Personalize your meal suggestions.{" "}
            <Text onPress={() => setOpen(true)} className="font-inter-semibold text-primary">
              Set preferences
            </Text>
          </AppText>
        </NoticeBanner>
      )}

      <PreferencesSheet
        visible={open}
        onClose={() => setOpen(false)}
        dietaryFocus={dietaryFocus}
        onDietaryFocusChange={(value) => setPrefs({ ...prefs, dietary_focus: value[0] ?? "none" })}
        allergens={allergens}
        onAllergensChange={(value) => setPrefs({ ...prefs, allergens: value })}
      />
    </>
  );
}
