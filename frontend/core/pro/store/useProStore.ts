import { Platform } from "react-native";
import Purchases, {
  INTRO_ELIGIBILITY_STATUS,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";
import { create } from "zustand";
import { getEarnedProUntil } from "@/api/proRewards";
import type { PlanKey } from "../proContent";

// Pro is a real App Store subscription, through RevenueCat: it checks the
// receipts with Apple and tells us whether this person has the `anoulam_pro`
// entitlement (Monthly or Yearly, both attached to it in RevenueCat). Every
// Pro gate reads `isPro` from here: that subscription, or earned Pro days
// still running (Pro rewards, from the database). RevenueCat is logged in as the Supabase
// user, so Pro follows the account (see `setUser`); buying needs an account
// (the Pro page asks guests to sign in first).
//
// iOS only for now (Android comes later): elsewhere nothing is configured
// and nobody is Pro. In Expo Go RevenueCat runs in a mock "preview" mode:
// test real purchases in a dev build, with a sandbox tester.

/** "expired" only ever appears on `lapsed`, never on `subscription`. */
export type ProStatus = "trial" | "active" | "cancelled" | "expired";

export type ProSubscription = {
  plan: PlanKey;
  status: ProStatus;
  /** ISO times. The latest purchase or renewal. */
  startedAt: string;
  /** End of the free trial (the first charge), null once past it. */
  trialEndsAt: string | null;
  /** The next charge, or (cancelled) when Pro ends. */
  renewsAt: string;
  /** The very first purchase of Pro on this account ("Pro since"). */
  since: string;
};

/** The RevenueCat entitlement both plans unlock (its identifier, set when
 *  the RevenueCat project was created; identifiers can't be renamed). */
const ENTITLEMENT = "anoulam_pro";
// One RevenueCat public key per store. Android's stays unset until Google
// Play subscriptions are connected in RevenueCat; until then Android runs
// without a key, the same as Expo Go.
const API_KEY =
  Platform.OS === "ios"
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : Platform.OS === "android"
      ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
      : undefined;

type ProStore = {
  /** The running subscription (trial, active or cancelled-but-running). */
  subscription: ProSubscription | null;
  isPro: boolean;
  /** Not Pro, but Pro ended within the last LAPSED_DAYS: Settings shows it
   *  as Expired with a way back. Its renewsAt is when Pro ended. */
  lapsed: ProSubscription | null;
  /** Earned Pro (Pro rewards: a first approved recipe, a first photo post),
   *  granted by the database: when it runs out (ISO), or null. While it's
   *  running the user is Pro even without a subscription. */
  earnedUntil: string | null;
  /** The store's price for each plan, in the buyer's currency ("₱99.00");
   *  missing until the offerings load (the Pro page falls back to PLANS). */
  prices: Partial<Record<PlanKey, string>>;
  /** Yearly's price per month, the same way ("₱49.92"). */
  yearlyPerMonth: string | null;
  /** Whether each plan's free trial is still open to this Apple ID (Apple
   *  gives one per subscription group). Missing: unknown, show the trial. */
  trialEligible: Partial<Record<PlanKey, boolean>>;
  /** Configures RevenueCat and loads Pro, prices and trial eligibility.
   *  Once, at launch. */
  load: () => Promise<void>;
  /** Signed in: RevenueCat logs in as this user, so their Pro follows the
   *  account. null (signed out): back to an anonymous RevenueCat user. */
  setUser: (userId: string | null) => Promise<void>;
  /** Re-reads Pro (e.g. coming back to Settings after managing it in the
   *  App Store). */
  refresh: () => void;
  /** Apple's purchase sheet for this plan. "cancelled" when the person
   *  closes it; throws on a real failure. */
  purchase: (plan: PlanKey) => Promise<"purchased" | "cancelled">;
  /** Finds this Apple ID's subscription again (new phone, reinstall).
   *  Resolves whether Pro is now on. */
  restore: () => Promise<boolean>;
};

const planOf = (productId: string): PlanKey => (productId.includes("yearly") ? "yearly" : "monthly");

// The `anoulam_pro` entitlement as the app's subscription: a trial while in Apple's
// free trial, cancelled once it won't renew (Pro still runs to the end of
// the period), else active.
function subscriptionOf(info: CustomerInfo): ProSubscription | null {
  const entitlement = info.entitlements.active[ENTITLEMENT];
  return entitlement ? fromEntitlement(entitlement) : null;
}

// How long an ended subscription keeps showing in Settings as Expired.
const LAPSED_DAYS = 30;

// Pro that has ended (RevenueCat keeps it under `all`, not `active`), while
// it's recent enough to show.
function lapsedOf(info: CustomerInfo): ProSubscription | null {
  const entitlement = info.entitlements.all[ENTITLEMENT];
  const ended = entitlement && fromEntitlement(entitlement);
  return ended ? asLapsed(ended) : null;
}

function asLapsed(sub: ProSubscription): ProSubscription | null {
  const endedMs = new Date(sub.renewsAt).getTime();
  if (endedMs > Date.now() || Date.now() - endedMs > LAPSED_DAYS * 24 * 60 * 60 * 1000) return null;
  return { ...sub, status: "expired", trialEndsAt: null };
}

function fromEntitlement(entitlement: CustomerInfo["entitlements"]["all"][string]): ProSubscription | null {
  if (!entitlement.expirationDate) return null;
  const inTrial = entitlement.periodType === "TRIAL";
  return {
    plan: planOf(entitlement.productIdentifier),
    status: !entitlement.willRenew ? "cancelled" : inTrial ? "trial" : "active",
    startedAt: entitlement.latestPurchaseDate,
    since: entitlement.originalPurchaseDate,
    trialEndsAt: inTrial ? entitlement.expirationDate : null,
    renewsAt: entitlement.expirationDate,
  };
}

export const useProStore = create<ProStore>((set, get) => {
  // configure() runs once; everything else waits for it.
  let configured: Promise<boolean> | null = null;
  let packages: Partial<Record<PlanKey, PurchasesPackage>> = {};
  let currentUser: string | null = null;

  // Re-reads Pro the moment the current period ends, so Pro switches off
  // on time without waiting for the next refresh (sandbox periods last
  // minutes; real ones, if the app stays open across the renewal).
  let expiryTimer: ReturnType<typeof setTimeout> | null = null;
  // This account has had Pro before (RevenueCat keeps ended entitlements):
  // Apple gives one free trial per subscription group, so no trial is
  // offered again, whatever the eligibility check said (it runs only at
  // launch and sign-in, and often answers "unknown").
  let hadPro = false;
  const NO_TRIAL: Partial<Record<PlanKey, boolean>> = { monthly: false, yearly: false };

  // Pro is a running subscription or earned days still left.
  const earnedActive = (until: string | null) => !!until && new Date(until).getTime() > Date.now();
  const publishPro = () => set({ isPro: !!get().subscription || earnedActive(get().earnedUntil) });

  // Earned Pro comes from the database, not RevenueCat (so it works even
  // where purchases aren't set up). Re-read on sign-in and refresh, and
  // switched off right when it ends.
  let earnedUser: string | null = null;
  let earnedTimer: ReturnType<typeof setTimeout> | null = null;
  const loadEarned = async () => {
    let earnedUntil: string | null = null;
    try {
      earnedUntil = earnedUser ? await getEarnedProUntil(earnedUser) : null;
    } catch {
      return; // Keep what we had.
    }
    set({ earnedUntil });
    publishPro();
    if (earnedTimer) clearTimeout(earnedTimer);
    earnedTimer = null;
    const msLeft = earnedUntil ? new Date(earnedUntil).getTime() - Date.now() : 0;
    if (msLeft > 0 && msLeft < 24 * 60 * 60 * 1000) earnedTimer = setTimeout(publishPro, msLeft + 1000);
  };

  const apply = (info: CustomerInfo) => {
    hadPro = !!info.entitlements.all[ENTITLEMENT];
    if (hadPro) set({ trialEligible: NO_TRIAL });
    let subscription = subscriptionOf(info);
    let lapsed = subscription ? null : lapsedOf(info);
    // Customer info can be older than the period it describes: one that
    // has already ended isn't Pro, whatever it last said.
    if (subscription && new Date(subscription.renewsAt).getTime() <= Date.now()) {
      lapsed = asLapsed(subscription);
      subscription = null;
    }
    set({ subscription, lapsed });
    publishPro();

    if (expiryTimer) clearTimeout(expiryTimer);
    expiryTimer = null;
    const msLeft = subscription ? new Date(subscription.renewsAt).getTime() - Date.now() : 0;
    // Only within a day (timers that long are unreliable; a later launch
    // or Settings visit catches the rest). A beat after the end, so
    // RevenueCat has the renewal or expiry by then.
    if (subscription && msLeft < 24 * 60 * 60 * 1000) {
      expiryTimer = setTimeout(() => get().refresh(), msLeft + 3000);
    }
  };

  const ready = () => {
    if (!configured) {
      configured = (async () => {
        if (!API_KEY) return false;
        if (__DEV__) await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        Purchases.configure({ apiKey: API_KEY });
        Purchases.addCustomerInfoUpdateListener(apply);
        return true;
      })().catch(() => false);
    }
    return configured;
  };

  // Prices from the current offering, then whether each plan's trial is
  // still open to this Apple ID.
  const loadOffering = async () => {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    packages = { monthly: current?.monthly ?? undefined, yearly: current?.annual ?? undefined };
    const prices: Partial<Record<PlanKey, string>> = {};
    for (const [plan, pkg] of Object.entries(packages) as [PlanKey, PurchasesPackage | undefined][]) {
      if (pkg) prices[plan] = pkg.product.priceString;
    }
    set({ prices, yearlyPerMonth: packages.yearly?.product.pricePerMonthString ?? null });
    await loadTrialEligibility();
  };

  const loadTrialEligibility = async () => {
    if (hadPro) return set({ trialEligible: NO_TRIAL });
    const ids = Object.values(packages)
      .filter((pkg): pkg is PurchasesPackage => !!pkg)
      .map((pkg) => pkg.product.identifier);
    if (ids.length === 0) return;
    const result = await Purchases.checkTrialOrIntroductoryPriceEligibility(ids);
    const trialEligible: Partial<Record<PlanKey, boolean>> = {};
    for (const [plan, pkg] of Object.entries(packages) as [PlanKey, PurchasesPackage | undefined][]) {
      const status = pkg && result[pkg.product.identifier]?.status;
      if (status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE) trialEligible[plan] = true;
      else if (status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE) trialEligible[plan] = false;
    }
    // A purchase may have landed while Apple was answering.
    set({ trialEligible: hadPro ? NO_TRIAL : trialEligible });
  };

  return {
    subscription: null,
    isPro: false,
    lapsed: null,
    earnedUntil: null,
    prices: {},
    yearlyPerMonth: null,
    trialEligible: {},
    load: async () => {
      if (!(await ready())) return;
      try {
        apply(await Purchases.getCustomerInfo());
        await loadOffering();
      } catch {
        // Offline or the store is unreachable: not Pro for now, and the Pro
        // page shows its own prices. The listener catches up later.
      }
    },
    setUser: async (userId) => {
      earnedUser = userId;
      void loadEarned();
      if (!(await ready()) || userId === currentUser) return;
      currentUser = userId;
      try {
        if (userId) {
          apply((await Purchases.logIn(userId)).customerInfo);
        } else if (!(await Purchases.isAnonymous())) {
          apply(await Purchases.logOut());
        }
        // A different person (or Apple ID history) can change trial
        // eligibility.
        await loadTrialEligibility();
      } catch {
        // Retried on the next sign-in or launch.
        currentUser = null;
      }
    },
    refresh: () => {
      void loadEarned();
      void (async () => {
        if (!(await ready())) return;
        try {
          // Past RevenueCat's few-minute cache: a cancel or switch made in
          // Apple's subscription screen should show as soon as we're back.
          await Purchases.invalidateCustomerInfoCache();
          apply(await Purchases.getCustomerInfo());
        } catch {
          // Keep what we had.
        }
      })();
    },
    purchase: async (plan) => {
      if (!(await ready())) throw new Error("Purchases aren't available on this device yet.");
      if (!packages[plan]) await loadOffering();
      const pkg = packages[plan];
      if (!pkg) throw new Error("This plan isn't available right now. Try again in a moment.");
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        apply(customerInfo);
        return get().isPro ? "purchased" : "cancelled";
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return "cancelled";
        throw error;
      }
    },
    restore: async () => {
      if (!(await ready())) return false;
      apply(await Purchases.restorePurchases());
      return get().isPro;
    },
  };
});

/** Apple's own subscription screen (switch plan, cancel). */
export const manageSubscription = async () => {
  await Purchases.showManageSubscriptions();
  // It opens over the app (Settings never loses focus), so re-read once
  // it's closed. Syncing first makes RevenueCat re-check the subscription
  // with Apple, so a cancel or switch made there shows straight away
  // instead of waiting for Apple's server notification.
  try {
    await Purchases.syncPurchases();
  } catch {
    // The refresh below still runs; the notification catches up later.
  }
  useProStore.getState().refresh();
};

export const useIsPro = () => useProStore((s) => s.isPro);
/** A subscription past its free trial (active, or cancelled but running).
 *  Pro rewards aren't pitched to these: earned days would only overlap Pro
 *  they're paying for. Trial users still see them, since earned days keep
 *  Pro on if they cancel the trial. */
export const usePaysForPro = () => useProStore((s) => !!s.subscription && s.subscription.status !== "trial");
export const useProSubscription = () => useProStore((s) => s.subscription);
