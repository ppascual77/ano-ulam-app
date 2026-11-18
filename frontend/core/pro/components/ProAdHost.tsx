import { useEffect } from "react";
import { Keyboard } from "react-native";
import { usePathname } from "expo-router";
import { isModalSheetOpen } from "@/frontend/components/ui";
import { useOnboardingStore } from "@/frontend/core/preferences/store/useOnboardingStore";
import { useProStore } from "../store/useProStore";
import { AD_DELAY_MS, useProAdStore } from "../store/useProAdStore";
import { ProFeatureSheet } from "./ProFeatureSheet";

// Screens the ad never interrupts: onboarding, the Pro page itself, and
// anything mid-task (adding a recipe, the admin tools).
const QUIET_ROUTES = [
  "/onboarding",
  "/pro",
  "/add-recipe",
  "/seed-meal",
  "/edit-meal",
  "/manage-",
  "/review-recipes",
  "/reported-posts",
  "/da-prices",
];

// The Pro ad (useProAdStore decides when one is due): shown a beat after
// the tap that made it due, or after a later tap if that moment wasn't
// calm (a sheet open, the keyboard up, a quiet screen). Never for Pro, and
// never before RevenueCat has answered (a subscriber who isn't loaded yet
// looks free).
export function ProAdHost() {
  const pathname = usePathname();
  const showing = useProAdStore((s) => s.showing);
  const due = useProAdStore((s) => s.due);
  const taps = useProAdStore((s) => s.taps);
  const close = useProAdStore((s) => s.close);

  useEffect(() => {
    void useProAdStore.getState().load();
  }, []);

  useEffect(() => {
    if (!due || showing) return;
    const timer = setTimeout(() => {
      const pro = useProStore.getState();
      if (pro.isPro || !pro.checked) return;
      if (!useOnboardingStore.getState().done) return;
      if (isModalSheetOpen() || Keyboard.isVisible()) return;
      if (QUIET_ROUTES.some((route) => pathname.startsWith(route))) return;
      useProAdStore.getState().show();
    }, AD_DELAY_MS);
    return () => clearTimeout(timer);
    // `taps`: each later tap retries a slot that couldn't show.
  }, [due, showing, taps, pathname]);

  return <ProFeatureSheet feature={showing} ad onClose={close} />;
}
