import { useEffect } from "react";
import { router } from "expo-router";
import { track } from "@/frontend/core/analytics/analytics";
import { ProFeatureSheet } from "@/frontend/core/pro/components/ProFeatureSheet";
import { useLoginGateStore } from "@/frontend/features/auth/store/useLoginGateStore";
import { closeSaveLimit, openSavedTab, useSaveFeedbackStore } from "../store/useSaveFeedbackStore";

type SaveLimitSheetProps = {
  /** "inline": rendered inside another open sheet (Meal Details), which
   *  passes its own way to the Pro page (a /pro screen would open behind it). */
  presentation?: "modal" | "inline";
  onOpenPro?: () => void;
};

// A free account trying to save past the cap: the unlimited-saves feature
// sheet (its reel: the count climbing to the cap, the cap sliding away, the
// count going on), not an error toast (useSaveFeedbackStore.announceSaveError
// opens it). Unlock Pro, or a quiet "Manage saved meals" to make room
// instead. Mounted once in app/_layout.tsx; Meal Details renders an inline
// copy while it's open (the same hosts as the login sheet), and the root copy
// steps aside.
export function SaveLimitSheet({ presentation = "modal", onOpenPro }: SaveLimitSheetProps) {
  const open = useSaveFeedbackStore((s) => s.limitOpen);
  const hosts = useLoginGateStore((s) => s.hosts);
  const steppedAside = presentation === "modal" && hosts > 0;
  useEffect(() => {
    if (open && !steppedAside) track("limit_sheet_shown", { kind: "saved_meals" });
  }, [open, steppedAside]);
  if (steppedAside) return null;

  return (
    <ProFeatureSheet
      feature={open ? "saves" : null}
      presentation={presentation}
      onClose={closeSaveLimit}
      secondary={presentation === "modal" ? { label: "Manage saved meals", onPress: openSavedTab } : undefined}
      onOpenPro={(copy) => {
        if (onOpenPro) return onOpenPro();
        router.push({ pathname: "/pro", params: copy ? { ...copy, source: "saved_limit" } : { source: "saved_limit" } });
      }}
    />
  );
}
