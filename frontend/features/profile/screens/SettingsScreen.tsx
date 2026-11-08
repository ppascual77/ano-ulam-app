import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type ScrollViewInstance } from "react-native";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ChevronRight, LogOut, Trash2 } from "lucide-react-native";
import { AppText, ChipSelect, ConfirmSheet, Screen, SegmentedSwitch, Toast, type ToastState } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useAuth, useDeleteAccount, useSignOut } from "@/frontend/features/auth/hooks/useAuth";
import { useAuthActivityStore } from "@/frontend/features/auth/store/useAuthActivityStore";
import type { UserPreferences } from "@/api/auth";
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
import { useReduceMotion, useReduceMotionStore } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { useSurpriseMeStore } from "@/frontend/core/preferences/store/useSurpriseMeStore";
import { useSeenIntrosStore } from "@/frontend/core/preferences/store/useSeenIntrosStore";
import { useProStore } from "@/frontend/core/pro/store/useProStore";
import { EarnedProCard, ProPlanCard } from "../components/settings/ProPlanCard";
import { ManagePlanSheet } from "../components/settings/ManagePlanSheet";
import { AvoidSummary } from "../components/settings/AvoidSummary";
import { ProUpgradeSheet } from "@/frontend/core/pro/components/ProUpgradeSheet";
import { AvoidIngredientsSheet } from "../components/settings/AvoidIngredientsSheet";
import { MacroGoalSheet } from "@/frontend/core/nutrition/components/MacroGoalSheet";
import { GOAL_OPTIONS, goalsFromTargets, targetsFromGoals } from "@/frontend/core/nutrition/macros";
import { DEFAULT_NUTRITION_GOALS } from "@/api/auth";
import { ProSettingRow } from "../components/settings/ProSettingRow";

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
type ProSettingKey = "avoid" | "goals";

const listNames = (names: string[]) =>
  `${names.slice(0, 3).join(", ")}${names.length > 3 ? ` and ${names.length - 3} more` : ""}`;
const foodName = (name: string) => name.split(",")[0];

// Meal plan length, an inline choice on its Settings row.
const PLAN_LENGTH_OPTIONS = [
  { value: "5" as const, label: "5 days" },
  { value: "7" as const, label: "7 days" },
];

// Settings > Pro rows that open a sheet, after Price alerts and Meal plan
// length. Each shows what's set once it's set (`summary`, null when nothing
// is), otherwise what it does. All act while Pro (see UserPreferences).

const PRO_SETTINGS: {
  key: ProSettingKey;
  label: string;
  description: string;
  summary: (prefs: UserPreferences) => string | null;
}[] = [
  {
    key: "avoid",
    label: "Ingredients to avoid",
    description: "Hide meals with ingredients you don't eat, everywhere in the app.",
    summary: ({ avoid_ingredients: list }) => (list.length === 0 ? null : `Avoiding ${listNames(list.map((a) => foodName(a.name)))}.`),
  },
  {
    key: "goals",
    label: "Nutrition goals",
    description: "Your daily targets. Meal plans aim at them, and meals show how they fit.",
    summary: ({ nutrition_goals: g }) =>
      g.calories
        ? [GOAL_OPTIONS.find((o) => o.value === g.goal)?.label, `${g.calories.toLocaleString()} kcal`, g.protein && `${g.protein} g protein`]
            .filter(Boolean)
            .join(" · ")
        : null,
  },
];

export default function SettingsScreen() {
  // section=newsletter scrolls to it; pro=<setting> opens that Pro sheet (the
  // unlock screen's try-it links); plan=1 opens Manage your plan.
  const params = useLocalSearchParams<{ section?: string; pro?: string; plan?: string }>();
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
  // upsell instead. With a subscription, its plan card sits on top
  // and opens Manage your plan (see useProStore).
  const isPro = useProStore((s) => s.isPro);
  const subscription = useProStore((s) => s.subscription);
  // Pro that ended in the last 30 days: shown as Expired, tapping to renew.
  const lapsed = useProStore((s) => s.lapsed);
  const earnedUntil = useProStore((s) => s.earnedUntil);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [proSheet, setProSheet] = useState<ProSettingKey | null>(null);
  const closeProSheet = () => setProSheet(null);
  const [manageOpen, setManageOpen] = useState(false);
  // A trial that ended or a cancelled plan that ran out, while away.
  useFocusEffect(useCallback(() => useProStore.getState().refresh(), []));
  // Deep links, once Settings has settled in (a sheet opening mid-push
  // looks rushed).
  useEffect(() => {
    const key = params.pro as ProSettingKey | undefined;
    const openPlan = params.plan === "1";
    if (!openPlan && !(key && PRO_SETTINGS.some((s) => s.key === key))) return;
    const timer = setTimeout(() => {
      if (openPlan) setManageOpen(true);
      else if (key) (isPro ? setProSheet(key) : setUpgradeOpen(true));
    }, SCROLL_TO_SECTION_DELAY_MS);
    return () => clearTimeout(timer);
    // Only for a new link.
  }, [params.pro, params.plan]);

  // ---- ?section=newsletter --------------------------------------------------

  const scrollRef = useRef<ScrollViewInstance>(null);
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

  // The app-wide overlay (the same spiral as signing in) covers the log-out
  // and the trip Home, then fades once Home is in place.
  const logOut = () => {
    const { setActivity } = useAuthActivityStore.getState();
    setActivity("loggingOut");
    setTimeout(async () => {
      try {
        if (isSignedIn) await signOut.mutateAsync();
      } finally {
        router.replace("/home");
        setActivity(null);
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
              {/* Nothing selected: no focus (stored as "none"). */}
              <ChipSelect
                mode="single"
                clearable
                options={DIETARY_FOCUS_OPTIONS}
                value={prefs.dietary_focus !== "none" ? [prefs.dietary_focus] : []}
                onChange={(value) => setPrefs({ ...prefs, dietary_focus: value[0] ?? "none" })}
              />
            </View>
            <View className="gap-3">
              <SettingsLabel>Food allergies</SettingsLabel>
              <ChipSelect
                mode="multi"
                clearable
                options={ALLERGEN_OPTIONS}
                value={prefs.allergens}
                onChange={(value) => setPrefs({ ...prefs, allergens: value })}
              />
            </View>
          </SettingsSection>

          <SettingsSection title="Pro">
            {subscription && <ProPlanCard subscription={subscription} onPress={() => setManageOpen(true)} />}
            {/* Earned Pro (no subscription) comes before an expired plan. */}
            {!subscription && earnedUntil && new Date(earnedUntil).getTime() > Date.now() && (
              <EarnedProCard until={earnedUntil} onPress={() => router.push("/pro")} />
            )}
            {!subscription && !isPro && lapsed && <ProPlanCard subscription={lapsed} onPress={() => router.push("/pro")} />}
            {/* The same full Pro page as buying (for a subscriber its footer
                shows the plan and Manage your plan instead of a price). */}
            {isPro && (
              <Pressable onPress={() => router.push("/pro")} accessibilityRole="button" className="flex-row items-center gap-3 active:opacity-60">
                <View className="flex-1">
                  <SettingsRowLabel>See all Pro features</SettingsRowLabel>
                  <SettingsRowDescription>Everything included in your plan.</SettingsRowDescription>
                </View>
                <ChevronRight color={colors.ink.subtle} size={18} />
              </Pressable>
            )}
            {!isPro && (
              <Pressable onPress={() => router.push("/pro")} accessibilityRole="button" className="flex-row items-center gap-3 active:opacity-60">
                <View className="flex-1">
                  <SettingsRowLabel>See everything in Pro</SettingsRowLabel>
                  <SettingsRowDescription>Compare Free and Pro, and pick a plan.</SettingsRowDescription>
                </View>
                <ChevronRight color={colors.ink.subtle} size={18} />
              </Pressable>
            )}
            {/* Price alerts: just on or off. */}
            <ProSettingRow
              label="Price alerts"
              description="The day's biggest price drops, at the top of Price Watch."
              locked={!isPro}
              toggle={{ value: prefs.price_alerts.enabled, onChange: (enabled) => setPrefs({ ...prefs, price_alerts: { enabled } }) }}
              onPress={() => (isPro ? setPrefs({ ...prefs, price_alerts: { enabled: !prefs.price_alerts.enabled } }) : setUpgradeOpen(true))}
            />
            {/* Meal plan length: 5 or 7 days, for each new plan. */}
            <ProSettingRow
              index={1}
              label="Meal plan length"
              description="How many days each new meal plan covers."
              locked={!isPro}
              control={
                <SegmentedSwitch
                  options={PLAN_LENGTH_OPTIONS}
                  value={String(prefs.planner_defaults.days) as "5" | "7"}
                  onChange={(value) => setPrefs({ ...prefs, planner_defaults: { days: value === "7" ? 7 : 5 } })}
                />
              }
              onPress={() => (isPro ? undefined : setUpgradeOpen(true))}
            />
            {PRO_SETTINGS.map((setting, index) => (
              <ProSettingRow
                key={setting.key}
                index={index + 2}
                label={setting.label}
                description={(isPro && setting.summary(prefs)) || setting.description}
                detail={
                  setting.key === "avoid" && isPro && prefs.avoid_ingredients.length > 0 ? (
                    <AvoidSummary avoided={prefs.avoid_ingredients} />
                  ) : undefined
                }
                locked={!isPro}
                onPress={() => (isPro ? setProSheet(setting.key) : setUpgradeOpen(true))}
              />
            ))}
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
            <LinkRow label="Privacy Policy" onPress={() => router.push("/privacy")} />
            <LinkRow label="Terms of Service" onPress={() => router.push("/terms")} />
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

      <AvoidIngredientsSheet visible={proSheet === "avoid"} onClose={closeProSheet} />
      {/* The same guided setup the Meal Planner uses: stats, goal, then
          recommended targets (adjustable). Saved to the account, and every
          new plan aims at it. */}
      <MacroGoalSheet
        visible={proSheet === "goals"}
        initialTargets={targetsFromGoals(prefs.nutrition_goals)}
        initialGoal={prefs.nutrition_goals.goal}
        servings={1}
        onClose={closeProSheet}
        onConfirm={(targets, goal) => {
          setPrefs({ ...prefs, nutrition_goals: goalsFromTargets(targets, goal) });
          closeProSheet();
        }}
        onTurnOff={
          targetsFromGoals(prefs.nutrition_goals)
            ? () => {
                setPrefs({ ...prefs, nutrition_goals: DEFAULT_NUTRITION_GOALS });
                closeProSheet();
              }
            : undefined
        }
      />
      <ManagePlanSheet visible={manageOpen} onClose={() => setManageOpen(false)} />
      <ProUpgradeSheet
        visible={upgradeOpen}
        title="Make every meal yours"
        body="Pro tells you when prices drop, hides what you don't eat, plans your week and tracks your goals."
        onClose={() => setUpgradeOpen(false)}
        onOpenPro={() => router.push("/pro")}
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

      <Toast toast={toast} onHide={() => setToast(null)} />
    </Screen>
  );
}
