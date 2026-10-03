// MOCK — Community feed posts. Same field names as the web app's
// food_posts rows (FoodPostCard's FoodPostType), and the same function
// names as the spec'd API, so wiring a real backend later is a swap of
// these function bodies. State lives in memory and resets on reload.

export type FoodPost = {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  caption: string | null;
  image_url: string | null;
  /** User ids. liked = includes(me), count = length. */
  liked_by: string[];
  created_at: string;
  link_url: string | null;
  link_title: string | null;
  link_description: string | null;
  link_image: string | null;
  gif_url: string | null;
  sticker_url: string | null;
  is_official?: boolean;
};

// Stand-in id for the signed-in user. There's no posts table keyed to
// real Supabase user ids yet, so "my posts" are the ones with this id.
export const MOCK_ME_ID = "me";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const empty = {
  link_url: null,
  link_title: null,
  link_description: null,
  link_image: null,
  gif_url: null,
  sticker_url: null,
};

let posts: FoodPost[] = [
  {
    ...empty,
    id: "p1",
    user_id: "u2",
    display_name: "Ate Lorna",
    avatar_url: null,
    caption: "Sunday lutong bahay — kare-kare with homemade bagoong 🥜",
    image_url: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd",
    liked_by: ["u3", "u4"],
    created_at: "2026-10-02T11:20:00Z",
  },
  {
    ...empty,
    id: "p2",
    user_id: MOCK_ME_ID,
    display_name: "You",
    avatar_url: null,
    caption: "Found this ₱150 budget meal guide, solid: www.example.com/budget",
    image_url: null,
    liked_by: [],
    created_at: "2026-10-01T08:00:00Z",
    link_url: "https://www.example.com/budget",
    link_title: "10 ulam under ₱150",
    link_description: "Easy weekday Filipino meals that won't break the bank.",
    link_image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd",
  },
  {
    ...empty,
    id: "p3",
    user_id: "u3",
    display_name: "Migs Cooks",
    avatar_url: null,
    caption: "First time making tortang talong from scratch. Tipid pero busog!",
    image_url: "https://images.unsplash.com/photo-1512058564366-18510be2db19",
    liked_by: ["u2", MOCK_ME_ID],
    created_at: "2026-09-30T19:45:00Z",
  },
  {
    ...empty,
    id: "p4",
    user_id: "u4",
    display_name: "Bea Santos",
    avatar_url: null,
    caption: "Anyone else eat sinigang when it's raining? Asim kilig 🌧️",
    image_url: null,
    liked_by: ["u2", "u3", "u5"],
    created_at: "2026-09-30T07:10:00Z",
  },
  {
    ...empty,
    id: "p5",
    user_id: "u5",
    display_name: "Kuya Jun",
    avatar_url: null,
    caption: "Me waiting for the adobo to reduce",
    image_url: null,
    liked_by: ["u4"],
    created_at: "2026-09-29T12:00:00Z",
    gif_url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
  },
  {
    ...empty,
    id: "p6",
    user_id: MOCK_ME_ID,
    display_name: "You",
    avatar_url: null,
    caption: "Meal prep for the week: chicken inasal + java rice. 5 boxes for ₱600 total.",
    image_url: "https://images.unsplash.com/photo-1547592180-85f173990554",
    liked_by: ["u2"],
    created_at: "2026-09-28T09:30:00Z",
  },
  {
    ...empty,
    id: "p7",
    user_id: "u2",
    display_name: "Ate Lorna",
    avatar_url: null,
    caption: "Tip: add a little sugar to your sinigang to balance the asim. Trust me.",
    image_url: null,
    liked_by: [],
    created_at: "2026-09-27T16:00:00Z",
  },
  {
    ...empty,
    id: "p8",
    user_id: "u6",
    display_name: "Carlo D.",
    avatar_url: null,
    caption: "Lomi night 🍜",
    image_url: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624",
    liked_by: ["u2", "u3", "u4", "u5"],
    created_at: "2026-09-26T20:15:00Z",
  },
  {
    ...empty,
    id: "p9",
    user_id: "u5",
    display_name: "Kuya Jun",
    avatar_url: null,
    caption: null,
    image_url: null,
    liked_by: [],
    created_at: "2026-09-25T10:00:00Z",
    sticker_url: "https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif",
  },
  {
    ...empty,
    id: "p10",
    user_id: "u4",
    display_name: "Bea Santos",
    avatar_url: null,
    caption: "Ginisang monggo Friday, as tradition demands 🙏",
    image_url: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b",
    liked_by: [MOCK_ME_ID],
    created_at: "2026-09-24T18:40:00Z",
  },
];

// Newest first, one page at a time.
export async function getCommunityPosts(offset: number, limit = 5): Promise<FoodPost[]> {
  await delay(600);
  return [...posts].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(offset, offset + limit);
}

export async function deletePost(id: string): Promise<void> {
  await delay(300);
  posts = posts.filter((post) => post.id !== id);
}

// Returns the post's new liked_by.
export async function togglePostLike(postId: string, userId: string): Promise<string[]> {
  await delay(300);
  const post = posts.find((p) => p.id === postId);
  if (!post) throw new Error("Post not found");
  post.liked_by = post.liked_by.includes(userId)
    ? post.liked_by.filter((id) => id !== userId)
    : [...post.liked_by, userId];
  return [...post.liked_by];
}
