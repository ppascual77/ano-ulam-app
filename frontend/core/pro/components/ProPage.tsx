import { type ReactNode, useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { ArrowRight, Check, Minus, X } from "lucide-react-native";
import { AppText, Button, showGlobalToast } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useAuth, useSignIn, type SignInProvider } from "@/frontend/features/auth/hooks/useAuth";
import { LoginGateSheet } from "@/frontend/features/auth/components/LoginGateSheet";
import { ProBadge } from "./ProBadge";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProStore, useProSubscription } from "../store/useProStore";
import { nextLine, planName } from "../subscriptionCopy";
import { ProUnlockOverlay } from "./ProUnlockOverlay";
import {
  COMPARE_ROWS,
  PLANS,
  QUOTES,
  PRESS,
  TRIAL_DAYS,
  YEARLY_SAVE_PCT,
  type CompareCell,
  type PlanKey,
} from "../proContent";

type ProPageProps = {
  onClose: () => void;
  /** The unlock screen is done ("Start exploring"): close. */
  onStarted: () => void;
  /** Off where navigating would happen under a sheet (inside Meal Details):
   *  hides the Manage your plan link. */
  allowLinks?: boolean;
  /** Settings' plan card: opens the plan's management instead. */
  onManage?: () => void;
  /** From an upsell, speaking to what was tapped (e.g. "Your next 4 days
   *  are ready", one word in orange). Defaults to "AnoUlam Pro". */
  title?: ReactNode;
  /** Defaults to Pro's one-line promise. */
  subtitle?: string;
};

// The full Pro page (ProUpgradeSheet is the quick version, and links here):
// the promise, press, Free vs Pro, a plan, then what people say. The button
// stays pinned at the bottom while the rest scrolls. Shown as the /pro
// screen, and inside the meal sheet (a screen can't open over it). Handles
// its own safe area, so the unlock screen can cover the whole page.
//
// Starting Pro: the button opens Apple's own purchase sheet (useProStore,
// through RevenueCat); once it goes through, the unlock screen plays over
// this page (the gates flip under it, so they're open when it ends). Guests
// sign in first, since Pro is tied to the account. Prices are the App
// Store's, in the buyer's currency (PLANS until they load).
export function ProPage({ onClose, onStarted, allowLinks = true, onManage, title, subtitle }: ProPageProps) {
  const insets = useSafeAreaInsets();
  const subscription = useProSubscription();
  const { purchase, restore, prices, trialEligible } = useProStore();
  const { session } = useAuth();
  const signIn = useSignIn();
  const [plan, setPlan] = useState<PlanKey>(subscription?.plan ?? "monthly");
  const chosen = PLANS[plan];
  const price = prices[plan] ?? `₱${chosen.price}`;
  // Only Apple knows if this Apple ID already had its trial; unknown counts
  // as eligible (Apple's sheet shows the real terms either way).
  const hasTrial = trialEligible[plan] !== false;
  const [buying, setBuying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const buy = async (userId: string) => {
    setBuying(true);
    try {
      // Make sure RevenueCat is on this account before buying (right after
      // signing in, the app-wide sync may not have run yet).
      await useProStore.getState().setUser(userId);
      if ((await purchase(plan)) === "purchased") setUnlocking(true);
    } catch (error) {
      showGlobalToast({ message: error instanceof Error ? error.message : "Couldn't start Pro. Try again.", tone: "error" });
    } finally {
      setBuying(false);
    }
  };

  const start = () => {
    if (session) void buy(session.user.id);
    else setGateOpen(true);
  };

  const signInAndBuy = async (provider: SignInProvider) => {
    const signedIn = await signIn.mutateAsync(provider).catch(() => null);
    if (!signedIn) return;
    setGateOpen(false);
    void buy(signedIn.user.id);
  };

  const restorePurchases = async () => {
    setRestoring(true);
    try {
      const found = await restore();
      showGlobalToast(
        found
          ? { message: "Pro is back on.", tone: "success" }
          : { message: "No Pro subscription found for this Apple ID.", tone: "error" },
      );
    } catch {
      showGlobalToast({ message: "Couldn't restore. Check your connection.", tone: "error" });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-between px-6 pb-2 pt-1">
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-full bg-ink-emphasis/5 active:opacity-60"
        >
          <X color={colors.ink.emphasis} size={20} />
        </Pressable>
        <ProBadge />
      </View>

      <ScrollView contentContainerClassName="gap-8 px-6 pb-8 pt-2" showsVerticalScrollIndicator={false}>
        <View>
          <AppText variant="sectionTitle" dot>
            {title ?? "AnoUlam Pro"}
          </AppText>
          <Text className="mt-2 font-inter-regular text-body text-ink-subtle">{subtitle ?? "Plan the week, spend less, and eat your way."}</Text>
        </View>

        <PressFeatures />
        <CompareTable />
        <PlanPicker plan={plan} onChange={setPlan} />
        <Quotes />
      </ScrollView>

      <View className="gap-3 border-t border-ink-emphasis/10 px-6 pb-2 pt-4">
        {subscription && !unlocking ? (
          <>
            <Text className="text-center font-inter-regular text-small text-ink-subtle">
              You&apos;re on {planName(subscription.plan)}. {nextLine(subscription)}
            </Text>
            {allowLinks && onManage ? (
              <Button label="Manage your plan" variant="muted" onPress={onManage} />
            ) : (
              <Button label="You have Pro" variant="secondary" disabled />
            )}
          </>
        ) : (
          <>
            <Text className="text-center font-inter-regular text-small text-ink-subtle">
              {hasTrial ? `${TRIAL_DAYS} days free, then ${price}/${chosen.per}.` : `${price}/${chosen.per}.`} Cancel anytime in the App Store.
            </Text>
            <Button
              label={hasTrial ? `Start ${TRIAL_DAYS}-day free trial` : `Subscribe for ${price}/${chosen.per}`}
              variant="secondary"
              loading={buying}
              celebrate={false}
              onPress={start}
            />
            <Pressable
              onPress={() => void restorePurchases()}
              disabled={restoring}
              accessibilityRole="button"
              hitSlop={8}
              className="items-center py-1 active:opacity-60"
            >
              <Text className="font-inter-medium text-small text-ink-subtle">{restoring ? "Restoring..." : "Restore purchases"}</Text>
            </Pressable>
          </>
        )}
      </View>

      <LoginGateSheet
        reason={gateOpen ? "pro" : null}
        onClose={() => setGateOpen(false)}
        onSignIn={(provider) => void signInAndBuy(provider)}
        isSigningIn={signIn.isPending}
      />

      {/* From the tap until the purchase settles, then the unlock. */}
      {(buying || unlocking) && <ProUnlockOverlay phase={unlocking ? "unlocked" : "confirming"} onDone={onStarted} />}
    </View>
  );
}

// Each press card is the page width less a peek of the next one, so it's
// clear there's more to swipe.
const PRESS_PEEK = 28;
const PRESS_GAP = 12;
const PAGE_GUTTER = 24;

// "Featured on": a swipeable row of cards, one per outlet (its logo and
// headline), each opening its article. Cards snap one at a time and all
// take the tallest one's height.
function PressFeatures() {
  const { width } = useWindowDimensions();
  const cardWidth = width - PAGE_GUTTER * 2 - PRESS_PEEK;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + PRESS_GAP}
      decelerationRate="fast"
      className="-mx-6"
      contentContainerStyle={{ gap: PRESS_GAP, paddingHorizontal: PAGE_GUTTER }}
    >
      {PRESS.map((item) => (
        <Pressable
          key={item.outlet}
          onPress={() => void Linking.openURL(item.url)}
          accessibilityRole="link"
          accessibilityLabel={`Featured on ${item.outlet}: ${item.headline}. Read the article.`}
          style={{ width: cardWidth }}
          className="gap-3 rounded-2xl border border-ink-emphasis/10 p-4 active:opacity-70"
        >
          <View className="flex-row items-center gap-2">
            <AppText variant="eyebrow" className="text-sub">
              Featured on
            </AppText>
            <Image
              source={item.logo}
              style={{ width: item.logoWidth, height: 20, borderRadius: item.boxedLogo ? 4 : 0 }}
              contentFit={item.boxedLogo ? "cover" : "contain"}
              accessibilityLabel={item.outlet}
            />
          </View>
          <Text className="flex-1 font-inter-semibold text-body text-ink-emphasis">{item.headline}</Text>
          <View className="flex-row items-center gap-1">
            <Text className="font-inter-medium text-small text-primary">Read the article</Text>
            <ArrowRight color={colors.primary} size={14} />
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Cell({ value, pro }: { value: CompareCell; pro?: boolean }) {
  if (value === true) return <Check color={pro ? colors.accent : colors.primary} size={18} strokeWidth={3} />;
  if (value === false) return <Minus color={colors.ink.placeholder} size={16} />;
  return (
    <Text className={`text-center font-inter-semibold text-small ${pro ? "text-accent" : "text-ink-subtle"}`} numberOfLines={1}>
      {value}
    </Text>
  );
}

// Free vs Pro, with the Pro column tinted orange top to bottom.
function CompareTable() {
  return (
    // No grid: whitespace lines the rows up, and the Pro column is one soft
    // orange band behind its cells (a little wider than Free's, so "Whole
    // week" fits with room). The title shares the header row with the Free
    // and PRO column labels.
    <View>
      <View pointerEvents="none" className="absolute bottom-0 right-0 top-0 w-24 rounded-2xl bg-accent/5" />
      <View className="flex-row items-center">
        <View className="flex-1 pr-2">
          <AppText variant="sectionSubtitle" dot>
            Free vs Pro
          </AppText>
        </View>
        <View className="w-20 items-center py-3">
          <Text className="font-inter-bold text-small text-ink-subtle">Free</Text>
        </View>
        <View className="w-24 items-center py-3">
          <ProBadge />
        </View>
      </View>
      {COMPARE_ROWS.map((row) => (
        <View key={row.label} className="flex-row items-stretch">
          <Text className="flex-1 py-3 pr-2 font-inter-medium text-body text-ink-emphasis">{row.label}</Text>
          <View className="w-20 items-center justify-center py-3">
            <Cell value={row.free} />
          </View>
          <View className="w-24 items-center justify-center py-3">
            <Cell value={row.pro} pro />
          </View>
        </View>
      ))}
    </View>
  );
}

function PlanPicker({ plan, onChange }: { plan: PlanKey; onChange: (plan: PlanKey) => void }) {
  return (
    <View className="gap-3">
      <AppText variant="sectionSubtitle" dot>
        Pick your plan
      </AppText>
      {/* Extra top room for the yearly card's "Save" tag. */}
      <View className="flex-row gap-3 pt-2">
        {(Object.keys(PLANS) as PlanKey[]).map((key) => (
          <PlanCard
            key={key}
            planKey={key}
            selected={plan === key}
            onPress={() => {
              if (plan === key) return;
              void Haptics.selectionAsync();
              onChange(key);
            }}
          />
        ))}
      </View>
    </View>
  );
}

// Selection colors, from the brand tokens with alpha (hex suffix), since
// interpolateColor needs raw values.
const CARD_BORDER = { off: `${colors.ink.emphasis}1F`, on: colors.primary };
const CARD_FILL = { off: colors.white, on: `${colors.primary}0D` };
const RADIO_RING = { off: `${colors.ink.emphasis}33`, on: colors.primary };
const SELECT_MS = 220;

// One plan. The border is always 2px (only its color changes), so selecting
// never shifts the layout. Selecting fades the border and fill in, pops the
// radio's dot in and gives the card a small press-and-settle.
function PlanCard({ planKey, selected, onPress }: { planKey: PlanKey; selected: boolean; onPress: () => void }) {
  const option = PLANS[planKey];
  // The App Store's price in the buyer's currency, once loaded.
  const storePrice = useProStore((s) => s.prices[planKey]);
  const yearlyPerMonth = useProStore((s) => s.yearlyPerMonth);
  const on = useSharedValue(selected ? 1 : 0);
  const press = useSharedValue(1);
  useEffect(() => {
    on.value = withTiming(selected ? 1 : 0, { duration: SELECT_MS, easing: Easing.out(Easing.cubic) });
    if (selected) press.value = withSequence(withTiming(0.97, { duration: 90 }), withSpring(1, { damping: 12, stiffness: 260, mass: 0.6 }));
  }, [selected, on, press]);

  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(on.value, [0, 1], [CARD_BORDER.off, CARD_BORDER.on]),
    backgroundColor: interpolateColor(on.value, [0, 1], [CARD_FILL.off, CARD_FILL.on]),
    transform: [{ scale: press.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(on.value, [0, 1], [RADIO_RING.off, RADIO_RING.on]),
  }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: on.value, transform: [{ scale: on.value }] }));

  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} className="flex-1">
      <Animated.View style={[{ borderWidth: 2 }, cardStyle]} className="flex-1 rounded-2xl px-4 py-4">
        {planKey === "yearly" && (
          <View className="absolute -top-3 right-3 rounded-full bg-accent px-2 py-1">
            <Text className="font-inter-extrabold text-sub text-white">SAVE {YEARLY_SAVE_PCT}%</Text>
          </View>
        )}
        <View className="flex-row items-center gap-2">
          <Animated.View style={[{ borderWidth: 2 }, ringStyle]} className="h-5 w-5 items-center justify-center rounded-full">
            <Animated.View style={dotStyle} className="h-2.5 w-2.5 rounded-full bg-primary" />
          </Animated.View>
          <Text className="font-inter-semibold text-body text-ink-emphasis">{option.label}</Text>
        </View>
        <Text className="mt-3 font-inter-extrabold text-heading text-ink-emphasis">
          {storePrice ?? `₱${option.price}`}
          <Text className="font-inter-regular text-small text-ink-subtle">/{option.per}</Text>
        </Text>
        {planKey === "yearly" && (
          <Text className="font-inter-regular text-small text-ink-subtle">{yearlyPerMonth ?? `₱${Math.round(option.price / 12)}`} a month</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

// Real comments about AnoUlam (the free web app), so the title doesn't call
// them Pro reviews.
function Quotes() {
  return (
    <View className="gap-3">
      <AppText variant="sectionSubtitle" dot>
        What people say about AnoUlam
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6" contentContainerClassName="gap-3 px-6">
        {QUOTES.map((quote) => (
          <View key={quote.author} className="w-64 justify-between gap-3 rounded-2xl border border-ink-emphasis/10 p-4">
            <View>
              <Text className="font-inter-extrabold text-heading text-accent">{"“"}</Text>
              <Text className="font-inter-regular text-body text-ink-emphasis">{quote.text}</Text>
            </View>
            <Text className="font-inter-medium text-small text-ink-subtle">u/{quote.author} on Reddit</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
