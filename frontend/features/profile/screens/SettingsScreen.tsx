import { useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ChevronRight, Lock, LogOut, Trash2 } from "lucide-react-native";
import { AppText, ChipSelect, ConfirmSheet, Screen, Spinner, Toast, type ToastState } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useAuth, useDeleteAccount, useSignOut } from "@/frontend/features/auth/hooks/useAuth";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";
import { ALLERGEN_OPTIONS, DIETARY_FOCUS_OPTIONS } from "@/frontend/core/preferences/options";
import { useAccountSettings, useAccountSettingsActions } from "../hooks/useProfile";
import {
  SettingsLabel,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsSection,
  SettingsToggle,
} from "../components/settings/SettingsSection";
import { WEB_APP_URL } from "@/frontend/core/posts/components/OfficialPostCard";
import { useReduceMotion, useReduceMotionStore } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { useSurpriseMeStore } from "@/frontend/core/preferences/store/useSurpriseMeStore";
import { useSeenIntrosStore } from "@/frontend/core/preferences/store/useSeenIntrosStore";
import { useProStore } from "@/frontend/core/pro/store/useProStore";
import { ProBadge } from "@/frontend/core/pro/components/ProBadge";
import { ProUpgradeSheet } from "@/frontend/core/pro/components/ProUpgradeSheet";
import { AvoidIngredientsSheet } from "../components/settings/AvoidIngredientsSheet";

const LOG_OUT_DELAY_MS = 2000;
const SUPPORT_EMAIL = "anoulam.app@gmail.com";
const APP_VERSION = Constants.expoConfig?.version ?? "dev";

// A tappable row inside a settings card (About links).
function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center justify-between active:opacity-60">
      <SettingsRowLabel>{label}</SettingsRowLabel>
      <ChevronRight color={colors.ink.subtle} size={20} />
    </Pressable>
  );
}
// Deep link /profile/settings?section=newsletter scrolls here after this.
const SCROLL_TO_SECTION_DELAY_MS = 300;

// /profile/settings, from the gear on your profile: privacy, newsletter,
// dietary preferences, Home's Surprise me tag, reduce motion, Delete account, About (legal links, feedback,
// version), and Log out at the very end.
export default function SettingsScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const signOut = useSignOut();
  const deleteAccount = useDeleteAccount();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Device-only (not account data): follows the phone's setting until set here.
  const reduceMotion = useReduceMotion();
  const setReduceMotion = useReduceMotionStore((s) => s.setReduceMotion);
  const resetIntros = useSeenIntrosStore((s) => s.reset);
  const showSurpriseMe = useSurpriseMeStore((s) => s.show);
  const setShowSurpriseMe = useSurpriseMeStore((s) => s.setShow);

  const settings = useAccountSettings();
  const settingsActions = useAccountSettingsActions();
  const [confirmUnsubscribe, setConfirmUnsubscribe] = useState(false);

  // Preferences are real (users.preferences, same as Home's Preferences
  // sheet). Without a session (dev on a device) changes stay local.
  const { prefs, setPrefs } = usePreferences();

  // ---- Pro ------------------------------------------------------------------
  // Pro rows show for everyone (with a lock); without Pro they open the
  // upsell instead (MOCK Pro: "Unlock" just flips it, see useProStore).
  const isPro = useProStore((s) => s.isPro);
  const setPro = useProStore((s) => s.setPro);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [avoidOpen, setAvoidOpen] = useState(false);
  const avoidedNames = prefs.avoid_ingredients.map((a) => a.name.split(",")[0]);

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

  const sendFeedback = () => {
    const subject = encodeURIComponent(`AnoUlam app feedback (v${APP_VERSION}, ${Platform.OS})`);
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`);
  };

  const runDelete = async () => {
    try {
      await deleteAccount.mutateAsync();
      setConfirmDelete(false);
      router.replace("/home");
    } catch {
      setConfirmDelete(false);
      setToast({ id: Date.now(), message: "Couldn't delete your account. Please try again.", tone: "error" });
    }
  };

  return (
    <Screen padded={false} edges={["top"]} dismissKeyboardOnTap={false}>
      <View className="flex-row items-center gap-3 px-5 pb-2 pt-4">
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
          <ArrowLeft color={colors.ink.emphasis} size={22} />
        </Pressable>
        <AppText variant="sectionTitle" dot>
          Settings
        </AppText>
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        {/* Bottom padding clears the home indicator (top-only safe area). */}
        <View className="mt-4 gap-8 px-5" style={{ paddingBottom: insets.bottom + 40 }}>
          {/* Most-used first: these change which meals you see. */}
          <SettingsSection title="Meal preferences">
            <View className="gap-3">
              <SettingsLabel>Dietary focus</SettingsLabel>
              <ChipSelect
                mode="single"
                required
                options={DIETARY_FOCUS_OPTIONS}
                value={[prefs.dietary_focus]}
                onChange={(value) => setPrefs({ ...prefs, dietary_focus: value[0] ?? "none" })}
              />
            </View>
            <View className="gap-3">
              <SettingsLabel>Food allergies</SettingsLabel>
              <ChipSelect
                mode="multi"
                options={ALLERGEN_OPTIONS}
                value={prefs.allergens}
                onChange={(value) => setPrefs({ ...prefs, allergens: value })}
              />
            </View>
          </SettingsSection>

          <SettingsSection title="Pro">
            <Pressable
              onPress={() => (isPro ? setAvoidOpen(true) : setUpgradeOpen(true))}
              accessibilityRole="button"
              className="flex-row items-center gap-3 active:opacity-60"
            >
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <SettingsRowLabel>Ingredients to avoid</SettingsRowLabel>
                  <ProBadge />
                </View>
                <SettingsRowDescription>
                  {isPro && avoidedNames.length > 0
                    ? `Avoiding ${avoidedNames.slice(0, 3).join(", ")}${avoidedNames.length > 3 ? ` and ${avoidedNames.length - 3} more` : ""}.`
                    : "Hide meals with ingredients you don't eat, everywhere in the app."}
                </SettingsRowDescription>
              </View>
              {isPro ? <ChevronRight color={colors.ink.subtle} size={18} /> : <Lock color={colors.ink.subtle} size={16} />}
            </Pressable>
          </SettingsSection>

          <SettingsSection title="App">
            <SettingsToggle
              label="Surprise me on Home"
              description="The pull-down tag on Home that picks a random meal when you can't decide. Turn it off to hide it."
              value={showSurpriseMe}
              onChange={setShowSurpriseMe}
            />
            <SettingsToggle
              label="Reduce motion"
              description="Skips page intros, swaps sliding transitions for fades, and stops numbers rolling. Also turns on with your phone's own reduce motion setting."
              value={reduceMotion}
              onChange={setReduceMotion}
            />
            <Pressable
              onPress={() => {
                resetIntros();
                setToast({ id: Date.now(), message: "Page intros will play again on your next visit.", tone: "success" });
              }}
              className="active:opacity-60"
            >
              <SettingsRowLabel>Replay page intros</SettingsRowLabel>
              <SettingsRowDescription>
                Each page's quick intro plays once. This shows them again the next time you open each page.
              </SettingsRowDescription>
            </Pressable>
          </SettingsSection>

          {/* The newsletter deep link (?section=newsletter) centers this one. */}
          <SettingsSection
            title="Privacy & notifications"
            onLayout={(e) => setNewsletterLayout({ y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height })}
          >
            <SettingsToggle
              label="Show saved meals on your profile"
              description="When enabled, visitors to your profile can see the meals you've saved."
              value={settings.data?.show_saved_public ?? false}
              onChange={settingsActions.setShowSaved}
            />
            <SettingsToggle
              label="Email newsletter"
              description="Receive occasional emails about new meals, features, and food tips from AnoUlam."
              value={settings.data?.newsletter_subscribed ?? false}
              // Turning it off asks first; turning it on just saves.
              onChange={(on) => (on ? settingsActions.setNewsletter(true) : setConfirmUnsubscribe(true))}
            />
          </SettingsSection>

          <SettingsSection title="About">
            <LinkRow label="Send feedback" onPress={sendFeedback} />
            <LinkRow label="Privacy Policy" onPress={() => void Linking.openURL(`${WEB_APP_URL}/privacy`)} />
            <LinkRow label="Terms of Service" onPress={() => void Linking.openURL(`${WEB_APP_URL}/terms`)} />
            <Text className="font-inter-regular text-body text-ink-subtle">Version {APP_VERSION}</Text>
          </SettingsSection>

          <View className="gap-5">
            <Pressable
              onPress={logOut}
              className="flex-row items-center justify-center gap-2 rounded-2xl border border-like py-4 active:bg-like-soft"
            >
              <LogOut color={colors.like} size={18} />
              <Text className="font-inter-semibold text-body-lg text-like">Log out</Text>
            </Pressable>
            {/* Deliberately quiet: a destructive action that shouldn't catch
                the eye while scrolling (the confirm sheet still guards it). */}
            <Pressable
              onPress={() =>
                isSignedIn
                  ? setConfirmDelete(true)
                  : setToast({ id: Date.now(), message: "Sign in to delete your account.", tone: "error" })
              }
              hitSlop={8}
              accessibilityRole="button"
              className="self-center active:opacity-60"
            >
              <Text className="font-inter-regular text-body text-ink-subtle underline">Delete account</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <AvoidIngredientsSheet visible={avoidOpen} onClose={() => setAvoidOpen(false)} />
      <ProUpgradeSheet
        visible={upgradeOpen}
        title="Make every meal yours"
        body="Pro hides meals with ingredients you don't eat, plans your whole week and more."
        onClose={() => setUpgradeOpen(false)}
        onUnlock={() => {
          setPro(true);
          setUpgradeOpen(false);
          // Not straight into the picker: two native modals at once can
          // get stuck (see BottomSheet's onClosed).
          setToast({ id: Date.now(), message: "Pro unlocked (test)", tone: "success" });
        }}
      />
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

      <ConfirmSheet
        visible={confirmDelete}
        icon={
          <View className="h-12 w-12 items-center justify-center rounded-full bg-like-soft">
            <Trash2 color={colors.like} size={20} />
          </View>
        }
        title="Delete your account?"
        body="This permanently deletes your account, your saved preferences and the recipes you've published. This can't be undone."
        confirmLabel={deleteAccount.isPending ? "Deleting…" : "Delete account"}
        busy={deleteAccount.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={runDelete}
      />

      {loggingOut && (
        <View className="absolute inset-0 items-center justify-center gap-3 bg-white">
          <Spinner size={28} color={colors.primary} trackColor={colors.webDivider} />
          <Text className="font-inter-medium text-body-lg text-ink-subtle">Logging out...</Text>
        </View>
      )}
      <Toast toast={toast} onHide={() => setToast(null)} />
    </Screen>
  );
}
