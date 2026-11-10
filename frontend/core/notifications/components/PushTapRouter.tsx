import { useEffect } from "react";
import { router } from "expo-router";
import { listenForPushTaps } from "../push";

// Where a tapped push lands. Price pushes (the Pro daily drop alert, the
// Saturday best buys) open Price Watch; "Your recipe is live" just opens the
// app, where the reward celebration plays. Rendered once in the root layout,
// inside the navigator's tree, so it can navigate.
export function PushTapRouter() {
  useEffect(
    () =>
      listenForPushTaps((data) => {
        if (data.type === "price_drop" || data.type === "weekly_best_buys") {
          // A beat, so a cold start's navigator is mounted first.
          setTimeout(() => router.navigate("/price-watch"), 300);
        }
      }),
    [],
  );
  return null;
}
