import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMealPlan } from "@/api/mealPlans";
import { showGlobalToast } from "@/frontend/components/ui";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { planKey } from "@/frontend/features/meal-planner/hooks/useSavedMealPlan";
import { planDates } from "@/frontend/features/meal-planner/utils/generatePlan";
import { usePantryActions } from "./usePantry";
import { CLEANUP_NOTE_MS, dayKey, useNudge, type CleanupNote } from "../store/useNudgeStore";

// The meal plan day cleanup's note (what a finished plan day took out of the
// pantry), shared by Home's header line and the Pantry sheet.

/** Whether the note's own plan is the saved one and still has a day today
 *  or later. A new plan (or a reused one, restarted today) has a different
 *  start date, so the old plan's note goes. Unknown (still loading) counts
 *  as running, so the line doesn't flicker. */
function useNotePlanRunning(note: CleanupNote | null): boolean {
  const userId = useAuth().session?.user.id ?? null;
  const { data: row, isSuccess } = useQuery({ queryKey: planKey(userId), queryFn: getMealPlan, enabled: !!userId });
  if (!note || !userId) return false;
  if (!isSuccess) return true;
  if (!row || !Array.isArray(row.days) || row.days.length === 0) return false;
  if (row.start_date !== note.planStart) return false;
  const [y, m, d] = row.start_date.split("-").map(Number);
  const dates = planDates(new Date(y, m - 1, d), row.days.length);
  return dayKey(dates[dates.length - 1]) >= dayKey(new Date());
}

/** The plan-day cleanup's note while it's fresh (12 hours) and its plan is
 *  still the one running, else null. Clears itself when the time is up, its
 *  plan has ended (nothing left to plan around) or a new plan replaced it. */
export function useCleanupNote(): CleanupNote | null {
  const { cleanupNote, setCleanupNote } = useNudge();
  const running = useNotePlanRunning(cleanupNote);
  const left = cleanupNote ? cleanupNote.at + CLEANUP_NOTE_MS - Date.now() : 0;
  useEffect(() => {
    if (!cleanupNote) return;
    if (left <= 0 || !running) return setCleanupNote(null);
    const timer = setTimeout(() => setCleanupNote(null), left);
    return () => clearTimeout(timer);
  }, [cleanupNote?.at, running]);
  return cleanupNote && left > 0 && running ? cleanupNote : null;
}

/** Puts what the cleanup took back in the pantry ("I didn't actually cook
 *  that") and drops the note, from Home's line or the Pantry sheet. */
export function useUndoCleanup() {
  const pantryActions = usePantryActions();
  const { setCleanupNote } = useNudge();
  return (note: CleanupNote) => {
    pantryActions.addMany(note.items);
    setCleanupNote(null);
    showGlobalToast({ tone: "success", message: "Put back in your pantry" });
  };
}
