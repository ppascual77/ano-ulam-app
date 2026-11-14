import { useMemo, useState } from "react";
import { Image, Linking, Pressable, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { BadgeCheck, BookOpen, Mail, PhilippinePeso, Utensils, Zap, type LucideIcon } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { MealCard } from "@/frontend/core/meals/components/card/MealCard";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { useRealMeals } from "@/frontend/core/meals/hooks/useRealMeals";
import { useStableShuffle } from "@/frontend/core/meals/hooks/useStableShuffle";
import { ImageLightbox } from "@/frontend/core/posts/components/ImageLightbox";
import { OFFICIAL_POSTS, OfficialPostCard, WEB_APP_URL } from "@/frontend/core/posts/components/OfficialPostCard";
import { ProfileHeader } from "../ProfileHeader";
import { ProfileScaffold } from "../ProfileScaffold";
import { OFFICIAL_TABS, type ProfileTab } from "../ProfileTabBar";
import { MealGrid } from "../MealGrid";
import { MealGridSkeleton } from "../MealGridSkeleton";
import { useMealDetail } from "@/frontend/core/meals/hooks/useMealDetail";

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

type Toast = (message: string, tone: "success" | "error") => void;

// 8 random catalog meals (bookmark only), About AnoUlam, Explore button.
function OfficialRecipesTab({ onToast }: { onToast: Toast }) {
  const { data: catalog, isLoading } = useRealMeals();
  // Picked once per visit; a catalog refresh (a save count changing) keeps
  // the same picks.
  const shuffled = useStableShuffle(catalog ?? []);
  const picks = useMemo(() => shuffled.slice(0, SHOWN_RECIPES), [shuffled]);
  const detail = useMealDetail();

  return (
    <View className="gap-8 pb-6">
      <View className="gap-4">
        <View>
          <Text className="font-inter-bold text-subheading text-ink-emphasis">Official Recipes</Text>
          {!!catalog && (
            <Text className="mt-0.5 font-inter-regular text-small text-ink-subtle">
              Showing {picks.length} of <Text className="font-inter-semibold text-primary">{catalog.length}</Text>{" "}
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
                onPress={() => detail.open(meal)}
              />
            )}
          />
        )}
      </View>

      <View className="gap-3">
        <Text className="font-inter-semibold text-body text-ink">About AnoUlam</Text>
        {TIPS.map(({ Icon, title, body }) => (
          <View key={title} className="flex-row gap-3 rounded-2xl bg-ink-emphasis/5 p-4">
            <View className="h-8 w-8 items-center justify-center rounded-xl border border-ink-emphasis/10 bg-white shadow-sm">
              <Icon color={colors.primary} size={18} />
            </View>
            <View className="flex-1">
              <Text className="font-inter-semibold text-body text-ink-emphasis">{title}</Text>
              <Text className="mt-0.5 font-inter-regular text-small text-ink-subtle">{body}</Text>
            </View>
          </View>
        ))}
      </View>

      <View className="gap-2">
        <Pressable
          onPress={() => router.navigate("/browse")}
          className="flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 active:scale-[0.98]"
        >
          <Utensils color={colors.white} size={16} />
          <Text className="font-inter-semibold text-body text-white">Explore All Meals</Text>
        </Pressable>
        <Text className="text-center font-inter-regular text-small text-ink-subtle">
          Browse the full catalog: {catalog?.length ?? "200+"} meals across all budgets
        </Text>
      </View>

      <MealDetailSheet meal={detail.meal} loading={detail.loading} onClose={detail.close} onNotify={onToast} />
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
              className="rounded-full border border-ink-emphasis/10 shadow-sm"
              style={{ width: 64, height: 64 }}
            />
          }
          badge={<BadgeCheck color={colors.white} fill={colors.verified} size={20} />}
        >
          <Pressable onPress={() => Linking.openURL(`mailto:${OFFICIAL_EMAIL}`)} className="mt-1.5 flex-row items-center gap-1 self-start">
            <Mail color={colors.primary} size={11} />
            <Text className="font-inter-regular text-small text-primary">{OFFICIAL_EMAIL}</Text>
          </Pressable>
        </ProfileHeader>
      }
      tabs={OFFICIAL_TABS}
      activeTab={tab}
      onTabChange={setTab}
      miniName="AnoUlam"
      miniAvatar={(size) => (
        <Image source={require("@/assets/icon.png")} className="rounded-full" style={{ width: size, height: size }} />
      )}
    >
      {tab === "recipes" ? <OfficialRecipesTab onToast={onToast} /> : <OfficialPostsTab onToast={onToast} />}
    </ProfileScaffold>
  );
}
