import { useState } from "react";
import { Text } from "@/frontend/components/ui/Text";
import { router } from "expo-router";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";
import { FREE_DAILY_SUGGESTIONS, GUEST_DAILY_SUGGESTIONS, dailyLimitFor } from "@/frontend/core/pro/proContent";
import { leftHint, useDailyLimit } from "@/frontend/core/pro/dailyLimits";
import { DailyLimitSheet } from "@/frontend/core/pro/components/DailyLimitSheet";
import type { PantryIngredient } from "../types";

// Suggest by Pantry's daily limit (see dailyLimits), for both ways into the
// results: Home's "What can you make?" card and Profile's Pantry tab. The
// card's count and match % stay free; only opening the meals counts. A new
// set of pantry ingredients counts once; reopening the same set is free.
// Out for the day, DailyLimitSheet opens instead.
export function usePantryResultsGate() {
  const isPro = useIsPro();
  const { isSignedIn } = useAuth();
  const daily = useDailyLimit("pantry", dailyLimitFor({ isPro, isGuest: !isSignedIn }, GUEST_DAILY_SUGGESTIONS, FREE_DAILY_SUGGESTIONS));
  const [limitSheetOpen, setLimitSheetOpen] = useState(false);

  const openResults = async (pantry: PantryIngredient[]) => {
    const signature = JSON.stringify(pantry.map((p) => p.id).sort());
    if (!(await daily.use(signature))) {
      setLimitSheetOpen(true);
      return;
    }
    router.push({
      pathname: "/pantry-results",
      // JSON: ingredient names can contain commas ("Chicken, thigh").
      params: { ids: JSON.stringify(pantry.map((p) => p.id)), names: JSON.stringify(pantry.map((p) => p.name)) },
    });
  };

  const hintText = leftHint(daily.left, "pantry suggestion");
  const hint = hintText ? <Text className="text-center font-inter-regular text-small text-ink-subtle">{hintText}</Text> : null;

  const limitSheet = (
    <DailyLimitSheet
      kind="pantry"
      visible={limitSheetOpen}
      what="pantry suggestions"
      limit={daily.limit}
      onClose={() => setLimitSheetOpen(false)}
      onOpenPro={() => router.push({ pathname: "/pro", params: { source: "limit_sheet" } })}
    />
  );

  return { openResults, hint, limitSheet };
}
