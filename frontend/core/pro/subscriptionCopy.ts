import { PLANS, type PlanKey } from "./proContent";
import type { ProSubscription } from "./store/useProStore";

// Wording for the (mock) subscription, shared by the Pro page's checkout,
// the unlock screen and Settings' plan card, so they never disagree.

/** "Nov 4" (adds the year when it isn't this year: "Nov 4, 2027"). */
export function formatPlanDate(iso: string): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

export const priceLine = (plan: PlanKey) => `₱${PLANS[plan].price}/${PLANS[plan].per}`;

export const planName = (plan: PlanKey) => `Pro ${PLANS[plan].label}`;

export const STATUS_LABEL: Record<ProSubscription["status"], string> = {
  trial: "Free trial",
  active: "Active",
  cancelled: "Cancelled",
};

/** One line on what happens next. */
export function nextLine(sub: ProSubscription): string {
  const date = formatPlanDate(sub.renewsAt);
  if (sub.status === "trial") return `Trial ends ${date}, then ${priceLine(sub.plan)}`;
  if (sub.status === "active" && sub.nextPlan) return `Switches to ${PLANS[sub.nextPlan].label} on ${date} · ${priceLine(sub.nextPlan)}`;
  if (sub.status === "active") return `Renews ${date} · ${priceLine(sub.plan)}`;
  return `Pro until ${date}. You won't be charged.`;
}

/** Whole days left until `iso` (at least 0). */
export const daysUntil = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
