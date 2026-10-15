import { create } from "zustand";
import { parseUserPreferences, type UserPreferences } from "@/api/auth";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { useUpdateUserProfile, useUserProfile } from "@/frontend/features/auth/hooks/useUserProfile";

// The user's preferences (users.preferences: dietary focus, allergens, Pro's
// ingredients to avoid...), for every screen that reads or changes them.
// The latest change is held here first, so every screen sees it at once
// (and Settings doesn't wait on the save). Signed in, it also saves to the
// account. Without a session (dev on a device, where Google sign-in can't
// finish) it only lives here, for the session. Change preferences through
// this hook only, or this copy goes stale.
const useLocalPreferences = create<{ prefs: UserPreferences | null }>(() => ({ prefs: null }));

export function usePreferences() {
  const { isSignedIn } = useAuth();
  const profile = useUserProfile();
  const updateProfile = useUpdateUserProfile();
  const local = useLocalPreferences((s) => s.prefs);
  const prefs = local ?? parseUserPreferences(profile.data?.preferences);

  const setPrefs = (next: UserPreferences) => {
    useLocalPreferences.setState({ prefs: next });
    if (isSignedIn) updateProfile.mutate({ preferences: next });
  };

  return { prefs, setPrefs };
}
