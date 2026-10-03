import { router } from "expo-router";
import { MOCK_ME_ID } from "@/frontend/core/posts/mock/posts";

// Where tapping an author goes (a meal's "Created by", a post's author):
// no poster = an official AnoUlam meal -> the official profile; yourself
// -> your own profile; anyone else -> their profile.
export function openProfile(userId: string | null | undefined, meId: string | null) {
  if (!userId) return router.push("/profile/anoulam");
  if (userId === meId || userId === MOCK_ME_ID) return router.push("/profile");
  router.push({ pathname: "/profile/[userId]", params: { userId } });
}
