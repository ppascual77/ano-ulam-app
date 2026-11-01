import { router } from "expo-router";

// Where tapping an author goes (a meal's "Created by", a post's author):
// no poster = an official AnoUlam meal -> the official profile; yourself
// -> your own profile; anyone else -> their profile.
export function openProfile(userId: string | null | undefined, meId: string | null) {
  if (!userId) return router.push("/profile/anoulam");
  if (userId === meId) return router.push("/profile");
  router.push({ pathname: "/profile/[userId]", params: { userId } });
}
