import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { getUserProfile, parseUserPreferences, updateUserProfile, type UserPreferences } from "@/api/auth";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { useUpdateUserProfile, useUserProfile } from "@/frontend/features/auth/hooks/useUserProfile";
import { queryClient } from "@/lib/queryClient";
import { authKeys } from "@/frontend/features/auth/queryKeys";

// The user's preferences (users.preferences: dietary focus, allergens, Pro's
// ingredients to avoid...), for every screen that reads or changes them.
// The latest change is held here first, so every screen sees it at once
// (and Settings doesn't wait on the save). Signed in, it also saves to the
// account. Change preferences through this hook only, or this copy goes
// stale.
//
// Guests: their preferences (from onboarding's "Continue without an
// account", or changed later) are kept on the phone, apart from any
// account's, and used while signed out. Signing in hands them to the account
// once (adoptGuestPreferences): copied in if the account has none yet,
// dropped if it already has its own.
const GUEST_KEY = "anoulam.guestPreferences";

const useLocalPreferences = create<{ prefs: UserPreferences | null; guest: UserPreferences | null }>(() => ({
  prefs: null,
  guest: null,
}));

/** At launch (app/_layout.tsx): a guest's saved preferences. */
export async function loadGuestPreferences() {
  try {
    const raw = await AsyncStorage.getItem(GUEST_KEY);
    if (raw) useLocalPreferences.setState({ guest: parseUserPreferences(JSON.parse(raw)) });
  } catch {
    // Unreadable: start from the defaults.
  }
}

function saveGuest(prefs: UserPreferences) {
  useLocalPreferences.setState({ guest: prefs });
  AsyncStorage.setItem(GUEST_KEY, JSON.stringify(prefs)).catch(() => {});
}

/** Onboarding's "Continue without an account": its picks, kept for the guest. */
export function saveGuestOnboardingPicks(picks: Pick<UserPreferences, "dietary_focus" | "allergens" | "goals">) {
  const base = useLocalPreferences.getState().guest ?? parseUserPreferences(null);
  saveGuest({ ...base, ...picks });
}

// An account that has never set its basics (a brand-new sign-up).
function hasNoBasics(raw: unknown) {
  const p = parseUserPreferences(raw as never);
  return (p.dietary_focus === "none" || !p.dietary_focus) && p.allergens.length === 0 && p.goals.length === 0;
}

/** Signed out (app/_layout.tsx): the account's preferences held for the
 *  session give way to the guest's (or the defaults). */
export function forgetSessionPreferences() {
  useLocalPreferences.setState({ prefs: null });
}

/** On every sign-in (app/_layout.tsx): a guest's preferences go to the
 *  account if it has none yet; either way the phone's guest copy is cleared,
 *  and the account's preferences are what show from now on. */
export async function adoptGuestPreferences(userId: string) {
  // Whatever was held for the last session (a guest's) mustn't override
  // the account's own.
  useLocalPreferences.setState({ prefs: null });
  const guest = useLocalPreferences.getState().guest;
  if (!guest) return;
  try {
    const profile = await getUserProfile(userId);
    if (hasNoBasics(profile.preferences)) {
      const account = parseUserPreferences(profile.preferences);
      const merged = { ...account, dietary_focus: guest.dietary_focus, allergens: guest.allergens, goals: guest.goals };
      const updated = await updateUserProfile(userId, { preferences: merged });
      queryClient.setQueryData(authKeys.userProfile(userId), updated);
    }
  } catch {
    // Couldn't reach the account: keep the guest copy for the next sign-in.
    return;
  }
  useLocalPreferences.setState({ guest: null });
  AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
}

export function usePreferences() {
  const { isSignedIn } = useAuth();
  const profile = useUserProfile();
  const updateProfile = useUpdateUserProfile();
  const local = useLocalPreferences((s) => s.prefs);
  const guest = useLocalPreferences((s) => s.guest);
  const prefs = local ?? (isSignedIn ? parseUserPreferences(profile.data?.preferences) : guest ?? parseUserPreferences(null));

  const setPrefs = (next: UserPreferences) => {
    useLocalPreferences.setState({ prefs: next });
    if (isSignedIn) updateProfile.mutate({ preferences: next });
    else saveGuest(next);
  };

  // From the latest preferences at the moment it runs (not this render's),
  // for changes that land later, e.g. an Undo tapped seconds after.
  const update = (change: (current: UserPreferences) => UserPreferences) =>
    setPrefs(change(useLocalPreferences.getState().prefs ?? prefs));

  return { prefs, setPrefs, update };
}
