// MOCK: the official AnoUlam account. There's no users.is_official yet, so
// its profile isn't a real user.

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The official account's own feed posts. None yet: the Posts tab shows the
// two hardcoded guide posts (OFFICIAL_POSTS) after these.
export async function getOfficialProfile() {
  await delay(300);
  return {
    user: { id: "anoulam", display_name: "AnoUlam", avatar_url: null, bio: "The official AnoUlam account." },
    posts: [],
  };
}
