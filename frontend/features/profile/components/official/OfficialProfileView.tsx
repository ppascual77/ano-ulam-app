import { useMemo, useState } from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { BadgeCheck, BookOpen, Mail, PhilippinePeso, Utensils, Zap, type LucideIcon } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { MealCard } from "@/frontend/core/meals/components/card/MealCard";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { useRealMeals } from "@/frontend/core/meals/hooks/useRealMeals";
import { ImageLightbox } from "@/frontend/core/posts/components/ImageLightbox";
import { OFFICIAL_POSTS, OfficialPostCard, WEB_APP_URL } from "@/frontend/core/posts/components/OfficialPostCard";
import { ProfileHeader } from "../ProfileHeader";
import { ProfileScaffold } from "../ProfileScaffold";
import { OFFICIAL_TABS, type ProfileTab } from "../ProfileTabBar";
import { MealGrid } from "../MealGrid";
import { MealGridSkeleton } from "../MealGridSkeleton";
import { useMealDetail } from "../../hooks/useMealDetail";

const OFFICIAL_EMAIL = "anoulamapp@gmail.com";
const SHOWN_RECIPES = 8;

const TIPS: { Icon: LucideIcon; title: string; body: string }[] = [
  {
    Icon: PhilippinePeso,
    title: "Budget-smart suggestions",
    body: "Set your budget and get AI-curated ulam picks that actually fit, no guessing, no overspending.",
  },
  {
    Icon: Zap,
    title: "Decide in seconds",
    body: "Stop the \"ano ulam?\" spiral. Get a meal pick instantly based on what's affordable today.",
  },
  {
    Icon: Utensils,
    title: "Track what you save",
    body: "Bookmark meals you love, build a grocery list automatically, and revisit your favorites anytime.",
  },
  {
    Icon: BookOpen,
    title: "Community recipes",
    body: "Browse recipes shared by real Filipinos: affordable, home-cooked, and community-approved.",
  },
];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type Toast = (message: string, tone: "success" | "error") => void;

// 8 random catalog meals (bookmark only), About AnoUlam, Explore button.
function OfficialRecipesTab({ onToast }: { onToast: Toast }) {
  const { data: catalog, isLoading } = useRealMeals();
  // Picked once per visit, not on every render.
  const picks = useMemo(() => shuffle(catalog ?? []).slice(0, SHOWN_RECIPES), [catalog]);
  const detail = useMealDetail();

  return (
    <View className="gap-8 pb-6">
      <View className="gap-4">
        <View>
          <Text className="font-inter-bold text-subheading text-web-ink">Official Recipes</Text>
          {!!catalog && (
            <Text className="mt-0.5 font-inter-regular text-small text-web-ink-muted">
              Showing {picks.length} of <Text className="font-inter-semibold text-brand-green">{catalog.length}</Text>{" "}
              community-approved meals
            </Text>
          )}
        </View>
        {isLoading ? (
          <MealGridSkeleton />
        ) : (
          <MealGrid
            items={picks}
            keyOf={(meal) => meal.id ?? meal.name}
            renderItem={(meal, width) => (
              <MealCard
                meal={meal}
                width={width}
                layout="grid"
                isFastFood={meal.category === "fast_food"}
                hideLike
                onPress={() => detail.open(meal.id)}
                onSaveError={(message) => onToast(message, "error")}
              />
            )}
          />
        )}
      </View>

      <View className="gap-3">
        <Text className="font-inter-semibold text-body text-web-ink-body">About AnoUlam</Text>
        {TIPS.map(({ Icon, title, body }) => (
          <View key={title} className="flex-row gap-3 rounded-2xl bg-web-divider/50 p-4">
            <View className="h-8 w-8 items-center justify-center rounded-xl border border-web-divider bg-white shadow-sm">
              <Icon color={colors.brandGreen.DEFAULT} size={18} />
            </View>
            <View className="flex-1">
              <Text className="font-inter-semibold text-body text-web-ink">{title}</Text>
              <Text className="mt-0.5 font-inter-regular text-small text-web-ink-muted">{body}</Text>
            </View>
          </View>
        ))}
      </View>

      <View className="gap-2">
        <Pressable
          onPress={() => router.navigate("/browse")}
          className="flex-row items-center justify-center gap-2 rounded-2xl bg-brand-green py-3.5 active:scale-[0.98]"
        >
          <Utensils color={colors.white} size={16} />
          <Text className="font-inter-semibold text-body text-white">Explore All Meals</Text>
        </Pressable>
        <Text className="text-center font-inter-regular text-small text-web-ink-muted">
          Browse the full catalog: {catalog?.length ?? "200+"} meals across all budgets
        </Text>
      </View>

      <MealDetailSheet meal={detail.meal} onClose={detail.close} onNotify={onToast} />
    </View>
  );
}

// The official account's posts (none yet) then the two guide posts.
function OfficialPostsTab({ onToast }: { onToast: Toast }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const share = async (path: string) => {
    await Clipboard.setStringAsync(`${WEB_APP_URL}${path}`);
    onToast("Copied to clipboard", "success");
  };

  return (
    <View className="gap-6 pb-6">
      {OFFICIAL_POSTS.map((post) => (
        <OfficialPostCard
          key={post.guideRoute}
          post={post}
          onShare={() => void share(post.guideRoute)}
          onOpenPhoto={(image) => setLightbox(image)}
        />
      ))}
      <ImageLightbox source={lightbox} onClose={() => setLightbox(null)} />
    </View>
  );
}

// The official AnoUlam profile body: branded header, Recipes / Posts tabs.
// Used by /profile/anoulam and by the own profile of the official account.
export function OfficialProfileView({ onToast }: { onToast: Toast }) {
  const [tab, setTab] = useState<ProfileTab>("recipes");

  return (
    <ProfileScaffold
      header={
        <ProfileHeader
          name="AnoUlam"
          avatarUrl={null}
          bio="The official AnoUlam account."
          avatar={
            <Image
              source={require("@/assets/icon.png")}
              className="rounded-full border border-web-divider shadow-sm"
              style={{ width: 64, height: 64 }}
            />
          }
          badge={<BadgeCheck color={colors.white} fill={colors.verified} size={20} />}
        >
          <Pressable onPress={() => Linking.openURL(`mailto:${OFFICIAL_EMAIL}`)} className="mt-1.5 flex-row items-center gap-1 self-start">
            <Mail color={colors.brandGreen.DEFAULT} size={11} />
            <Text className="font-inter-regular text-small text-brand-green">{OFFICIAL_EMAIL}</Text>
          </Pressable>
        </ProfileHeader>
      }
      tabs={OFFICIAL_TABS}
      activeTab={tab}
      onTabChange={setTab}
    >
      {tab === "recipes" ? <OfficialRecipesTab onToast={onToast} /> : <OfficialPostsTab onToast={onToast} />}
    </ProfileScaffold>
  );
}
