import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, View, useWindowDimensions, type ScrollViewInstance } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import Constants from "expo-constants";
import Animated, { Easing, FadeInDown } from "react-native-reanimated";
import { Gift } from "lucide-react-native";
import { allRewardsEarned, useProRewardProgress } from "@/frontend/core/pro/hooks/useProRewardProgress";
import { POST_REWARD_DAYS, RECIPE_REWARD_DAYS } from "@/frontend/core/pro/proContent";
import { AccountCard } from "../components/settings/AccountCard";
import { FreeLimitsCard } from "../components/settings/FreeLimitsCard";
import { ProPitchCard } from "../components/settings/ProPitchCard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ChevronRight, LogOut, Trash2 } from "lucide-react-native";
import { AppText, ConfirmSheet, Screen, SegmentedSwitch, Toast, type ToastState } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useAuth, useDeleteAccount, useSignOut } from "@/frontend/features/auth/hooks/useAuth";
import { useAuthActivityStore } from "@/frontend/features/auth/store/useAuthActivityStore";
import type { UserPreferences } from "@/api/auth";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";
import { ALLERGEN_OPTIONS, DIETARY_FOCUS_OPTIONS } from "@/frontend/core/preferences/options";
import { useAccountSettings, useAccountSettingsActions } from "../hooks/useProfile";
import {
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
import { AvoidIngredientsSheet } from "../components/settings/AvoidIngredientsSheet";
import { MacroGoalSheet } from "@/frontend/core/nutrition/components/MacroGoalSheet";
import { GOAL_OPTIONS, goalsFromTargets, targetsFromGoals } from "@/frontend/core/nutrition/macros";
import { DEFAULT_NUTRITION_GOALS } from "@/api/auth";
import { ProSettingRow } from "../components/settings/ProSettingRow";
import { PreferencesSheet } from "@/frontend/core/budget/components/PreferencesSheet";
import { ProFeatureSheet, type ProFeatureKey } from "@/frontend/core/pro/components/ProFeatureSheet";
import { canReceivePush, enablePush } from "@/frontend/core/notifications/push";
import { openPrivacyPolicy, openTerms } from "@/frontend/core/app/legalLinks";
import { BlockedAccountsSheet } from "../components/settings/BlockedAccountsSheet";
import { usePushPermission } from "@/frontend/core/notifications/hooks/usePushPermission";

const LOG_OUT_DELAY_MS = 2000;
const SUPPORT_EMAIL = "anoulam.app@gmail.com";
const APP_VERSION = Constants.expoConfig?.version ?? "dev";

// A tappable row inside a settings card (About links).
// With `value`, what's currently set shows under the label (Meal
// preferences); tapping opens where it's edited.
function LinkRow({ label, value, onPress }: { label: string; value?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="flex-row items-center justify-between gap-3 active:opacity-60">
      <View className="flex-1">
        <SettingsRowLabel>{label}</SettingsRowLabel>
        {value != null && <SettingsRowDescription>{value}</SettingsRowDescription>}
      </View>
      <ChevronRight color={colors.ink.subtle} size={20} />
    </Pressable>
  );
}
// Deep link /profile/settings?section=newsletter scrolls here after this.
const SCROLL_TO_SECTION_DELAY_MS = 300;

// /profile/settings, from the gear on your profile: your account and plan,
// Pro (the pitch and your free limits, or your plan), meal preferences, Pro
// features, notifications, app, privacy, About (legal links, feedback,
// version), and Log out with Delete account at the very end. About also
// opens the app tour (onboarding's slides again, with Skip).
type ProSettingKey = "avoid" | "goals";

const listNames = (names: string[]) =>
  `${names.slice(0, 3).join(", ")}${names.length > 3 ? ` and ${names.length - 3} more` : ""}`;
const foodName = (name: string) => name.split(",")[0];
const allergenLabel = (value: string) => ALLERGEN_OPTIONS.find((o) => o.id === value)?.label ?? value;

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
    description: "Hide meals with any ingredient, everywhere.",
    summary: ({ avoid_ingredients: list }) => (list.length === 0 ? null : `Avoiding ${listNames(list.map((a) => foodName(a.name)))}.`),
  },
  {
    key: "goals",
    label: "Nutrition goals",
    description: "Daily targets your meal plans aim at.",
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
  // Push notifications: on while the account setting is on AND pushes reach
  // the phone (banners, or quiet: on by default from sign-in). Turning it on
  // asks iOS for banners, or opens iOS Settings once it's been refused there.
  const push = usePushPermission();
  const pushOn = (settings.data?.push_enabled ?? true) && canReceivePush(push.permission);
  const setPushOn = async (on: boolean) => {
    if (!on) return settingsActions.setPushEnabled(false);
    settingsActions.setPushEnabled(true);
    if (push.permission === "denied") return void Linking.openSettings();
    const allowed = await enablePush("settings").catch(() => false);
    push.refresh();
    if (!allowed) setToast({ id: Date.now(), message: "Notifications are off for AnoUlam. Turn them on in iOS Settings.", tone: "error" });
  };
  const showBanners = async () => {
    await enablePush("settings").catch(() => false);
    push.refresh();
  };
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
  const [prefsOpen, setPrefsOpen] = useState(false);
  // A locked Pro feature, tapped: its reel and the way in.
  const [featureSheet, setFeatureSheet] = useState<ProFeatureKey | null>(null);
  const [proSheet, setProSheet] = useState<ProSettingKey | null>(null);
  const closeProSheet = () => setProSheet(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  // How a free account can still earn Pro (the first reward not yet earned).
  const rewards = useProRewardProgress().data;
  const earnTip =
    !isSignedIn || !rewards || allRewardsEarned(rewards)
      ? null
      : rewards.approvedRecipes === 0
        ? { days: RECIPE_REWARD_DAYS, how: "share your first recipe", href: "/add-recipe" as const }
        : { days: POST_REWARD_DAYS, how: "post your first food photo", href: "/discover" as const };

  // Sections rise in one after another as Settings opens (none with
  // Reduce motion).
  const enter = (i: number) => (reduceMotion ? undefined : FadeInDown.delay(i * 60).duration(360).easing(Easing.out(Easing.cubic)));
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
      else if (key) (isPro ? setProSheet(key) : setFeatureSheet(key));
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
          {/* Who you are and your plan, then Pro: the pitch for a free
              account, or the plan for a subscriber. */}
          <Animated.View entering={enter(0)}>
            <AccountCard />
          </Animated.View>

          <Animated.View entering={enter(1)} className="-mt-3 gap-3">
            {subscription && <ProPlanCard subscription={subscription} onPress={() => setManageOpen(true)} />}
            {/* Earned Pro (no subscription) comes before an expired plan. */}
            {!subscription && earnedUntil && new Date(earnedUntil).getTime() > Date.now() && (
              <EarnedProCard until={earnedUntil} onPress={() => router.push({ pathname: "/pro", params: { source: "settings" } })} />
            )}
            {!subscription && !isPro && lapsed && <ProPlanCard subscription={lapsed} onPress={() => router.push({ pathname: "/pro", params: { source: "settings" } })} />}
            {/* What Pro includes is a checklist inside the plan card. */}
            {!isPro && !lapsed && <ProPitchCard />}
            {!isPro && earnTip && (
              <Pressable
                onPress={() => router.push(earnTip.href)}
                accessibilityRole="button"
                className="flex-row items-center gap-3 rounded-2xl border border-dashed border-accent/40 bg-accent/5 px-4 py-3 active:opacity-80"
              >
                <View className="h-8 w-8 items-center justify-center rounded-full bg-accent/15">
                  <Gift color={colors.accent} size={16} />
                </View>
                <Text className="flex-1 font-inter-regular text-small text-ink-emphasis">
                  Or <Text className="font-inter-bold">earn {earnTip.days} days of Pro free</Text>: {earnTip.how}
                </Text>
                <ChevronRight color={colors.accent} size={16} />
              </Pressable>
            )}
          </Animated.View>

          {!isPro && (
            <Animated.View entering={enter(2)} className="gap-3">
              <View className="flex-row items-baseline gap-2">
                <AppText variant="sectionSubtitle" dot>
                  Your free limits
                </AppText>
                <Text className="font-inter-semibold text-small text-ink-placeholder">Unlimited with Pro</Text>
              </View>
              <FreeLimitsCard />
            </Animated.View>
          )}

          {/* Every Pro setting in one place, price drop alerts included.
              Locked, each says what it would do for you and opens the
              upsell. */}
          <Animated.View entering={enter(3)}>
            <SettingsSection title="Pro features">
              {isPro && (
                <Pressable onPress={() => router.push({ pathname: "/pro", params: { source: "settings" } })} accessibilityRole="button" className="flex-row items-center gap-3 active:opacity-60">
                  <View className="flex-1">
                    <SettingsRowLabel>See all Pro features</SettingsRowLabel>
                    <SettingsRowDescription>Everything in your plan.</SettingsRowDescription>
                  </View>
                  <ChevronRight color={colors.ink.subtle} size={18} />
                </Pressable>
              )}
              <ProSettingRow
                index={1}
                label="Meal plan length"
                description={isPro ? "Days in each new plan." : "Plan 5 or 7 days at once."}
                locked={!isPro}
                control={
                  <SegmentedSwitch
                    options={PLAN_LENGTH_OPTIONS}
                    value={String(prefs.planner_defaults.days) as "5" | "7"}
                    onChange={(value) => setPrefs({ ...prefs, planner_defaults: { days: value === "7" ? 7 : 5 } })}
                  />
                }
                onPress={() => (isPro ? undefined : setFeatureSheet("planLength"))}
              />
              {PRO_SETTINGS.map((setting, index) => (
                <ProSettingRow
                  key={setting.key}
                  index={index + 2}
                  label={setting.label}
                  description={
                    isPro
                      ? setting.summary(prefs) || setting.description
                      : setting.key === "avoid" && prefs.allergens.length > 0
                        ? `You avoid ${listNames(prefs.allergens.map(allergenLabel)).toLowerCase()}. Pro can hide any ingredient, like ampalaya.`
                        : setting.description
                  }
                  detail={
                    setting.key === "avoid" && isPro && prefs.avoid_ingredients.length > 0 ? (
                      <AvoidSummary avoided={prefs.avoid_ingredients} />
                    ) : undefined
                  }
                  locked={!isPro}
                  onPress={() => (isPro ? setProSheet(setting.key) : setFeatureSheet(setting.key))}
                />
              ))}
              <ProSettingRow
                index={4}
                label="Price drop alerts"
                description={pushOn || !isPro ? "A push when an ingredient drops 5%+." : "Turn on push notifications below to get these."}
                locked={!isPro}
                onPress={() =>
                  isPro
                    ? settingsActions.setPriceAlerts(!(settings.data?.push_price_alerts ?? true))
                    : setFeatureSheet("alerts")
                }
                toggle={pushOn ? { value: settings.data?.push_price_alerts ?? true, onChange: settingsActions.setPriceAlerts } : undefined}
              />
            </SettingsSection>
          </Animated.View>

          {/* These change which meals you see: what's set, tap to edit in
              the same sheet as Home's preferences banner. */}
          <Animated.View entering={enter(4)}>
            <SettingsSection title="Meal preferences">
              <LinkRow
                label="Dietary focus"
                value={DIETARY_FOCUS_OPTIONS.find((o) => o.id === prefs.dietary_focus)?.label ?? "None"}
                onPress={() => setPrefsOpen(true)}
              />
              <LinkRow
                label="Food allergies"
                value={prefs.allergens.length > 0 ? listNames(prefs.allergens.map(allergenLabel)) : "None"}
                onPress={() => setPrefsOpen(true)}
              />
            </SettingsSection>
          </Animated.View>

          {/* The newsletter deep link (?section=newsletter) centers this one. */}
          <Animated.View entering={enter(5)}>
            <SettingsSection
              title="Notifications"
              onLayout={(e) => setNewsletterLayout({ y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height })}
            >
              {/* Hidden on a build without the notifications module. */}
              {push.permission != null && push.permission !== "unavailable" && (
                <SettingsToggle
                  label="Push notifications"
                  description={
                    push.permission === "denied"
                      ? "Off in iOS Settings. Turn on to open them."
                      : push.permission === "quiet" && pushOn
                        ? "Arriving quietly, no banner or sound."
                        : "Recipe approvals and price news."
                  }
                  value={pushOn}
                  onChange={(on) => void setPushOn(on)}
                />
              )}
              {pushOn && (
                <SettingsToggle
                  label="Weekly best buys"
                  description={isPro ? "Saturdays: the week's 3 biggest drops." : "Saturdays: the week's biggest drop."}
                  value={settings.data?.push_weekly_digest ?? true}
                  onChange={settingsActions.setWeeklyDigest}
                />
              )}
              {pushOn && (
                <SettingsToggle
                  label="New meals"
                  description="Sundays: the meals added that week."
                  value={settings.data?.push_new_meals ?? true}
                  onChange={settingsActions.setNewMeals}
                />
              )}
              {/* Quiet (the default): one tap to banners and sound. */}
              {push.permission === "quiet" && pushOn && (
                <Pressable onPress={() => void showBanners()} hitSlop={6} className="-mt-2 self-start active:opacity-60">
                  <Text className="font-inter-semibold text-small text-primary">Show as banners with sound</Text>
                </Pressable>
              )}
              <SettingsToggle
                label="Email newsletter"
                description="New meals and food tips, now and then."
                value={settings.data?.newsletter_subscribed ?? false}
                // Turning it off asks first; turning it on just saves.
                onChange={(on) => (on ? settingsActions.setNewsletter(true) : setConfirmUnsubscribe(true))}
              />
            </SettingsSection>
          </Animated.View>

          <Animated.View entering={enter(6)}>
            <SettingsSection title="App">
              <SettingsToggle
                label="Surprise me on Home"
                description="The pull-down random meal."
                value={showSurpriseMe}
                onChange={setShowSurpriseMe}
              />
              <SettingsToggle
                label="Reduce motion"
                description="Fewer animations. Follows your phone's setting too."
                value={reduceMotion}
                onChange={setReduceMotion}
              />
              {/* Reduce motion skips intros, so replaying them would do
                  nothing: disabled and dimmed, saying why. */}
              <Pressable
                onPress={() => {
                  resetIntros();
                  setToast({ id: Date.now(), message: "Page intros will play again on your next visit.", tone: "success" });
                }}
                disabled={reduceMotion}
                accessibilityState={{ disabled: reduceMotion }}
                className={reduceMotion ? "opacity-40" : "active:opacity-60"}
              >
                <SettingsRowLabel>Replay page intros</SettingsRowLabel>
                <SettingsRowDescription>
                  {reduceMotion ? "Off while Reduce motion is on." : "Show each page's intro once more."}
                </SettingsRowDescription>
              </Pressable>
            </SettingsSection>
          </Animated.View>

          <Animated.View entering={enter(7)}>
            <SettingsSection title="Privacy">
              <SettingsToggle
                label="Show saved meals on profile"
                description="Visitors can see what you save."
                value={settings.data?.show_saved_public ?? false}
                onChange={settingsActions.setShowSaved}
              />
              {isSignedIn && (
                <LinkRow label="Blocked accounts" value="People whose posts you don't see" onPress={() => setBlockedOpen(true)} />
              )}
            </SettingsSection>
          </Animated.View>

          <Animated.View entering={enter(8)}>
          <SettingsSection title="About">
            <LinkRow label="How AnoUlam works" value="Take the quick tour again" onPress={() => router.push("/onboarding-tour")} />
            <LinkRow label="Send feedback" onPress={sendFeedback} />
            <LinkRow label="Privacy Policy" onPress={openPrivacyPolicy} />
            <LinkRow label="Terms of Service" onPress={openTerms} />
            <Text className="font-inter-regular text-body text-ink-subtle">Version {APP_VERSION}</Text>
          </SettingsSection>
          </Animated.View>

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
      <ProFeatureSheet feature={featureSheet} onClose={() => setFeatureSheet(null)} />
      <PreferencesSheet
        visible={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        dietaryFocus={prefs.dietary_focus !== "none" ? [prefs.dietary_focus] : []}
        onDietaryFocusChange={(value) => setPrefs({ ...prefs, dietary_focus: value[0] ?? "none" })}
        allergens={prefs.allergens}
        onAllergensChange={(value) => setPrefs({ ...prefs, allergens: value })}
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

      <BlockedAccountsSheet
        visible={blockedOpen}
        onClose={() => setBlockedOpen(false)}
        onToast={(message, tone) => setToast({ id: Date.now(), message, tone })}
      />

      <Toast toast={toast} onHide={() => setToast(null)} />
    </Screen>
  );
}
