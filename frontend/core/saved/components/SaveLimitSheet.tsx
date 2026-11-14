import { router } from "expo-router";
import { DailyLimitSheet } from "@/frontend/core/pro/components/DailyLimitSheet";
import { useLoginGateStore } from "@/frontend/features/auth/store/useLoginGateStore";
import { closeSaveLimit, openSavedTab, useSaveFeedbackStore } from "../store/useSaveFeedbackStore";
import { SAVED_MEALS_LIMIT } from "../types";

type SaveLimitSheetProps = {
  /** "inline": rendered inside another open sheet (Meal Details), which
   *  passes its own way to the Pro page (a /pro screen would open behind it). */
  presentation?: "modal" | "inline";
  onOpenPro?: () => void;
};

// A free account trying to save past the cap: a Pro pitch, not an error
// toast (useSaveFeedbackStore.announceSaveError opens it). Unlock Pro, or a
// quiet "Manage saved meals" to make room instead. Mounted once in
// app/_layout.tsx; Meal Details renders an inline copy while it's open (the
// same hosts as the login sheet), and the root copy steps aside.
export function SaveLimitSheet({ presentation = "modal", onOpenPro }: SaveLimitSheetProps) {
  const open = useSaveFeedbackStore((s) => s.limitOpen);
  const hosts = useLoginGateStore((s) => s.hosts);
  if (presentation === "modal" && hosts > 0) return null;

  return (
    <DailyLimitSheet
      kind="saved_meals"
      visible={open}
      what="saved meals"
      limit={SAVED_MEALS_LIMIT}
      title={`You've saved ${SAVED_MEALS_LIMIT} meals`}
      body="That's the most a free account keeps. Pro saves as many meals as you want."
      secondary={presentation === "modal" ? { label: "Manage saved meals", onPress: openSavedTab } : undefined}
      presentation={presentation}
      onClose={closeSaveLimit}
      onOpenPro={onOpenPro ?? (() => router.push({ pathname: "/pro", params: { source: "saved_limit" } }))}
    />
  );
}
