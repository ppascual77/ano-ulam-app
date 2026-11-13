import { useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Json } from "@/lib/database.types";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { useUpdateUserProfile, useUserProfile } from "@/frontend/features/auth/hooks/useUserProfile";
import { ACTIVITY_OPTIONS, GOAL_OPTIONS, type Activity, type Goal, type Sex } from "../macros";

// The body stats behind the nutrition goal setup, saved to the account
// (users.body_stats, owner-only) so the setup prefills on any phone. Health
// data, so it's never part of `preferences` or the public profile.

export type SavedBodyStats = {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  bodyFatPct: number | null;
  goal: Goal;
  activity: Activity;
};

// Where the setup kept them on the phone before 2026-11-13. Moved into the
// account once (then removed) the first time the setup loads signed in.
const LEGACY_KEY = "planner_body_stats";

const isGoal = (v: unknown): v is Goal => GOAL_OPTIONS.some((o) => o.value === v);
const isActivity = (v: unknown): v is Activity => ACTIVITY_OPTIONS.some((o) => o.value === v);
const isSex = (v: unknown): v is Sex => v === "male" || v === "female";

function parse(value: Json | null | undefined): SavedBodyStats | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.weightKg !== "number" || typeof v.heightCm !== "number" || typeof v.age !== "number" || !isSex(v.sex)) return null;
  return {
    weightKg: v.weightKg,
    heightCm: v.heightCm,
    age: v.age,
    sex: v.sex,
    bodyFatPct: typeof v.bodyFatPct === "number" ? v.bodyFatPct : null,
    goal: isGoal(v.goal) ? v.goal : "maintain",
    activity: isActivity(v.activity) ? v.activity : "moderate",
  };
}

// The old phone copy was the setup's form as typed (strings).
function fromLegacy(raw: string): SavedBodyStats | null {
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    const n = (x: unknown) => Number(String(x ?? "").replace(/[^0-9.]/g, ""));
    const weightKg = n(d.weight);
    const heightCm = n(d.height);
    const age = n(d.age);
    if (!(weightKg > 0 && heightCm > 0 && age > 0) || !isSex(d.sex)) return null;
    const bodyFat = String(d.bodyFat ?? "").trim();
    return {
      weightKg,
      heightCm,
      age,
      sex: d.sex,
      bodyFatPct: bodyFat ? n(bodyFat) : null,
      goal: isGoal(d.goal) ? d.goal : "maintain",
      activity: isActivity(d.activity) ? d.activity : "moderate",
    };
  } catch {
    return null;
  }
}

/** The signed-in user's saved body stats (null until set), and `save`. */
export function useBodyStats() {
  const { session } = useAuth();
  const row = useUserProfile().data;
  const update = useUpdateUserProfile();
  const stats = parse(row?.body_stats);

  // One-time move of the phone copy into the account. If the account
  // already has stats, the phone copy is just dropped.
  const moved = useRef(false);
  useEffect(() => {
    if (!session || !row || moved.current) return;
    moved.current = true;
    AsyncStorage.getItem(LEGACY_KEY)
      .then((raw) => {
        if (!raw) return;
        const legacy = row.body_stats ? null : fromLegacy(raw);
        if (!legacy) return AsyncStorage.removeItem(LEGACY_KEY);
        update.mutate({ body_stats: legacy as unknown as Json }, { onSuccess: () => void AsyncStorage.removeItem(LEGACY_KEY) });
      })
      .catch(() => {});
  }, [session, row]);

  const save = (next: SavedBodyStats) => {
    if (!session) return;
    update.mutate({ body_stats: next as unknown as Json });
  };

  return { stats, save };
}
