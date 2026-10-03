import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Bell, Eye, LogOut, SlidersHorizontal } from "lucide-react-native";
import { ChipSelect, ConfirmSheet, Screen, Spinner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { parseUserPreferences, type UserPreferences } from "@/api/auth";
import { useAuth, useSignOut } from "@/frontend/features/auth/hooks/useAuth";
import { useUpdateUserProfile, useUserProfile } from "@/frontend/features/auth/hooks/useUserProfile";
import { ALLERGEN_OPTIONS, DIETARY_FOCUS_OPTIONS } from "@/frontend/core/preferences/options";
import { useAccountSettings, useAccountSettingsActions } from "../hooks/useProfile";
import { SettingsLabel, SettingsSection, SettingsToggle } from "../components/settings/SettingsSection";
import { ProfileFooter } from "../components/ProfileFooter";

const LOG_OUT_DELAY_MS = 2000;
// Deep link /profile/settings?section=newsletter scrolls here after this.
const SCROLL_TO_SECTION_DELAY_MS = 300;

// /profile/settings, from the gear on your profile: privacy, newsletter,
// dietary preferences, and Log out at the very end.
export default function SettingsScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  const { height: windowHeight } = useWindowDimensions();
  const { isSignedIn } = useAuth();
  const signOut = useSignOut();

  const settings = useAccountSettings();
  const settingsActions = useAccountSettingsActions();
  const [confirmUnsubscribe, setConfirmUnsubscribe] = useState(false);

  // Preferences are real (users.preferences, same as Home's Preferences
  // sheet). Without a session (dev on a device) changes stay local.
  const profile = useUserProfile();
  const updateProfile = useUpdateUserProfile();
  const [localPrefs, setLocalPrefs] = useState<UserPreferences | null>(null);
  const prefs = localPrefs ?? parseUserPreferences(profile.data?.preferences);
  const setPrefs = (next: UserPreferences) => {
    setLocalPrefs(next);
    if (isSignedIn) updateProfile.mutate({ preferences: next });
  };

  // ---- ?section=newsletter --------------------------------------------------

  const scrollRef = useRef<ScrollView>(null);
  const [newsletterLayout, setNewsletterLayout] = useState<{ y: number; height: number } | null>(null);
  useEffect(() => {
    if (params.section !== "newsletter" || !newsletterLayout) return;
    const timer = setTimeout(() => {
      // Center the card.
      const y = newsletterLayout.y - (windowHeight - newsletterLayout.height) / 2;
      scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
    }, SCROLL_TO_SECTION_DELAY_MS);
    return () => clearTimeout(timer);
  }, [params.section, newsletterLayout, windowHeight]);

  // ---- log out ----------------------------------------------------------------

  const [loggingOut, setLoggingOut] = useState(false);
  const logOut = () => {
    setLoggingOut(true);
    setTimeout(async () => {
      try {
        if (isSignedIn) await signOut.mutateAsync();
      } finally {
        router.replace("/home");
      }
    }, LOG_OUT_DELAY_MS);
  };

  return (
    <Screen padded={false} edges={["top"]} dismissKeyboardOnTap={false}>
      <View className="flex-row items-center gap-3 px-5 pb-2 pt-4">
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
          <ArrowLeft color={colors.webInk.muted} size={20} />
        </Pressable>
        <Text className="font-inter-semibold text-subheading text-web-ink">Settings</Text>
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        <View className="mt-2 gap-4 px-5">
          <SettingsSection Icon={Eye} title="Privacy">
            <SettingsToggle
              label="Show saved meals on your profile"
              description="When enabled, visitors to your profile can see the meals you've saved."
              value={settings.data?.show_saved_public ?? false}
              onChange={settingsActions.setShowSaved}
            />
          </SettingsSection>

          <SettingsSection
            Icon={Bell}
            title="Notifications"
            onLayout={(e) => setNewsletterLayout({ y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height })}
          >
            <SettingsToggle
              label="Email Newsletter"
              description="Receive occasional emails about new meals, features, and food tips from AnoUlam."
              value={settings.data?.newsletter_subscribed ?? false}
              // Turning it off asks first; turning it on just saves.
              onChange={(on) => (on ? settingsActions.setNewsletter(true) : setConfirmUnsubscribe(true))}
            />
          </SettingsSection>

          <SettingsSection Icon={SlidersHorizontal} title="Preferences">
            <View className="gap-3">
              <SettingsLabel>Dietary Focus</SettingsLabel>
              <ChipSelect
                mode="single"
                required
                options={DIETARY_FOCUS_OPTIONS}
                value={[prefs.dietary_focus]}
                onChange={(value) => setPrefs({ ...prefs, dietary_focus: value[0] ?? "none" })}
              />
            </View>
            <View className="gap-3">
              <SettingsLabel>Food Allergies</SettingsLabel>
              <ChipSelect
                mode="multi"
                options={ALLERGEN_OPTIONS}
                value={prefs.allergens}
                onChange={(value) => setPrefs({ ...prefs, allergens: value })}
              />
            </View>
          </SettingsSection>

          <Pressable
            onPress={logOut}
            className="mt-2 flex-row items-center justify-center gap-2 rounded-2xl border border-like py-3.5 active:bg-like-soft"
          >
            <LogOut color={colors.like} size={16} />
            <Text className="font-inter-semibold text-body text-like">Log out</Text>
          </Pressable>
        </View>

        <ProfileFooter />
      </ScrollView>

      <ConfirmSheet
        visible={confirmUnsubscribe}
        title="Sad to see you go 😢"
        body="Do you really want to unsubscribe from AnoUlam emails? You'll miss out on new meals and updates."
        cancelLabel="Keep me in"
        confirmLabel="Unsubscribe"
        onCancel={() => setConfirmUnsubscribe(false)}
        onConfirm={() => {
          settingsActions.setNewsletter(false);
          setConfirmUnsubscribe(false);
        }}
      />

      {loggingOut && (
        <View className="absolute inset-0 items-center justify-center gap-3 bg-white">
          <Spinner size={28} color={colors.brandGreen.DEFAULT} trackColor={colors.webDivider} />
          <Text className="font-inter-medium text-body text-web-ink-muted">Logging out...</Text>
        </View>
      )}
    </Screen>
  );
}
