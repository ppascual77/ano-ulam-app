import { useAuth } from "./useAuth";
import { useUserProfile } from "./useUserProfile";

// The signed-in user's name for greetings and avatars: the display name
// they set on their profile, else the one Google gave at sign-in. Nothing
// for a guest (callers greet without a name).
export function useDisplayName(): { fullName?: string; firstName?: string } {
  const { session } = useAuth();
  const profile = useUserProfile();
  const meta = session?.user.user_metadata ?? {};
  const fullName =
    profile.data?.display_name?.trim() ||
    (meta.full_name as string | undefined)?.trim() ||
    (meta.name as string | undefined)?.trim() ||
    undefined;
  return { fullName, firstName: fullName?.split(/\s+/)[0] };
}
