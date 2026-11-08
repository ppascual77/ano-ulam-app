import { PLANS, type PlanKey } from "./proContent";
import type { ProSubscription } from "./store/useProStore";

// Wording for the subscription, shared by the Pro page,
// the unlock screen and Settings' plan card, so they never disagree.

/** "Nov 4, 2026": always with the year, so a yearly plan's renewal never
 *  reads like it's days away. */
export function formatPlanDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export const priceLine = (plan: PlanKey) => `₱${PLANS[plan].price}/${PLANS[plan].per}`;

export const planName = (plan: PlanKey) => `Pro ${PLANS[plan].label}`;

export const STATUS_LABEL: Record<ProSubscription["status"], string> = {
  trial: "Free trial",
  active: "Active",
  cancelled: "Cancelled",
  expired: "Expired",
};

/** One line on what happens next. */
export function nextLine(sub: ProSubscription): string {
  const date = formatPlanDate(sub.renewsAt);
  if (sub.status === "trial") return `Trial ends ${date}, then ${priceLine(sub.plan)}`;
  if (sub.status === "active") return `Renews ${date} · ${priceLine(sub.plan)}`;
  if (sub.status === "expired") return `Pro ended ${date}. Renew anytime.`;
  return `Pro until ${date}. You won't be charged.`;
}

/** How long until `iso`, in the largest whole unit that fits: "3 days",
 *  "5 hours", "12 minutes" (under a day it never rounds up to "1 day":
 *  sandbox periods last minutes, and a last day shouldn't read as a full
 *  one). */
export function timeLeft(iso: string): string {
  const minutes = Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 60_000));
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (minutes >= 24 * 60) return unit(Math.floor(minutes / (24 * 60)), "day");
  if (minutes >= 60) return unit(Math.floor(minutes / 60), "hour");
  if (minutes >= 1) return unit(minutes, "minute");
  return "Less than a minute";
}
