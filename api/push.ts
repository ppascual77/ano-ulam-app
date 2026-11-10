import { supabase } from "@/lib/supabase";

// This phone's Expo push token, saved for the signed-in user (moved from any
// account that had it before). The database sends the pushes itself
// (20261110000000_push_notifications: a recipe turning approved).
export async function registerPushToken(token: string, platform: "ios" | "android") {
  const { error } = await supabase.rpc("register_push_token", { p_token: token, p_platform: platform });
  if (error) throw error;
}

// Log out: this phone stops getting the account's pushes.
export async function unregisterPushToken(token: string) {
  const { error } = await supabase.rpc("unregister_push_token", { p_token: token });
  if (error) throw error;
}
