import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { TRIAL_DAYS, type PlanKey } from "../proContent";

// MOCK Pro subscription: no payments yet (subscriptions need the App Store
// and Google Play). Starting the "trial" on the Pro page makes one here, and
// Settings shows and manages it (switch plan, cancel, resume). It behaves
// like a real one (trial, renewal dates, Pro until the period ends after a
// cancel) but lives on this phone only (AsyncStorage) and nothing is
// charged. Every Pro gate reads `isPro` from here, so swapping in a real
// entitlement later is one place.

export type ProStatus = "trial" | "active" | "cancelled";

export type ProSubscription = {
  plan: PlanKey;
  status: ProStatus;
  /** ISO times. */
  startedAt: string;
  /** End of the free trial (the first charge), null once past it. */
  trialEndsAt: string | null;
  /** The next charge, or (cancelled) when Pro ends. */
  renewsAt: string;
  /** Cancelled during the trial: Pro ends with the trial, never charged. */
  cancelledInTrial?: boolean;
  /** A switch scheduled for the next renewal (paid plans only: a trial
   *  switches right away, since nothing has been charged yet). */
  nextPlan?: PlanKey;
};

type ProStore = {
  subscription: ProSubscription | null;
  isPro: boolean;
  load: () => Promise<void>;
  /** Re-checks dates (a trial that ended, a cancelled plan that ran out). */
  refresh: () => void;
  startTrial: (plan: PlanKey) => void;
  /** Trial: changes the plan now. Active: schedules it for the next renewal
   *  (switching back to the current plan drops a scheduled switch). */
  switchPlan: (plan: PlanKey) => void;
  cancel: () => void;
  resume: () => void;
  /** Test only: Pro ends right now, as if the period ran out. */
  endNow: () => void;
};

const STORAGE_KEY = "anoulam.mockProSubscription";

const DAY_MS = 24 * 60 * 60 * 1000;
const addPeriod = (iso: string, plan: PlanKey) => {
  const date = new Date(iso);
  if (plan === "yearly") date.setFullYear(date.getFullYear() + 1);
  else date.setMonth(date.getMonth() + 1);
  return date.toISOString();
};

// Moves a subscription to now: a trial past its end becomes active (the
// first renewal), renewals roll forward (taking up a scheduled plan switch),
// a cancelled plan past its end is gone.
function advance(sub: ProSubscription | null, now = Date.now()): ProSubscription | null {
  if (!sub) return null;
  let next = { ...sub };
  if (next.status === "cancelled") return new Date(next.renewsAt).getTime() > now ? next : null;
  if (next.status === "trial" && next.trialEndsAt && new Date(next.trialEndsAt).getTime() <= now) {
    next = { ...next, status: "active", trialEndsAt: null, renewsAt: addPeriod(next.trialEndsAt, next.plan) };
  }
  while (new Date(next.renewsAt).getTime() <= now) {
    const plan = next.nextPlan ?? next.plan;
    next = { ...next, plan, nextPlan: undefined, renewsAt: addPeriod(next.renewsAt, plan) };
  }
  return next;
}

function parse(value: string | null): ProSubscription | null {
  if (!value) return null;
  try {
    const o = JSON.parse(value) as Partial<ProSubscription>;
    const ok =
      (o.plan === "monthly" || o.plan === "yearly") &&
      (o.status === "trial" || o.status === "active" || o.status === "cancelled") &&
      typeof o.startedAt === "string" &&
      typeof o.renewsAt === "string";
    return ok ? (o as ProSubscription) : null;
  } catch {
    return null;
  }
}

export const useProStore = create<ProStore>((set, get) => {
  const save = (subscription: ProSubscription | null) => {
    set({ subscription, isPro: !!subscription });
    const write = subscription ? AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(subscription)) : AsyncStorage.removeItem(STORAGE_KEY);
    write.catch(() => {});
  };

  return {
    subscription: null,
    isPro: false,
    load: async () => {
      try {
        save(advance(parse(await AsyncStorage.getItem(STORAGE_KEY))));
      } catch {
        // Unreadable: not Pro.
      }
    },
    refresh: () => {
      const { subscription } = get();
      const next = advance(subscription);
      if (JSON.stringify(next) !== JSON.stringify(subscription)) save(next);
    },
    startTrial: (plan) => {
      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * DAY_MS).toISOString();
      save({ plan, status: "trial", startedAt: now.toISOString(), trialEndsAt, renewsAt: trialEndsAt });
    },
    switchPlan: (plan) => {
      const { subscription } = get();
      if (!subscription || subscription.status === "cancelled") return;
      if (subscription.status === "trial") save({ ...subscription, plan, nextPlan: undefined });
      else save({ ...subscription, nextPlan: plan === subscription.plan ? undefined : plan });
    },
    cancel: () => {
      const { subscription } = get();
      if (subscription && subscription.status !== "cancelled") {
        save({ ...subscription, status: "cancelled", cancelledInTrial: subscription.status === "trial", nextPlan: undefined });
      }
    },
    resume: () => {
      const { subscription } = get();
      if (!subscription || subscription.status !== "cancelled") return;
      const inTrial = !!subscription.trialEndsAt && new Date(subscription.trialEndsAt).getTime() > Date.now();
      save({ ...subscription, status: inTrial ? "trial" : "active", cancelledInTrial: undefined });
    },
    endNow: () => save(null),
  };
});

export const useIsPro = () => useProStore((s) => s.isPro);
export const useProSubscription = () => useProStore((s) => s.subscription);
