import { memo, useMemo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Image, type ImageSource } from "expo-image";
import { router } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { ProBadge } from "@/frontend/core/pro/components/ProBadge";
import { useRealMeals } from "@/frontend/core/meals/hooks/useRealMeals";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";

const PHOTO_COUNT = 3;
const PHOTO_SIZE = 44;
const PHOTO_OVERLAP = 14;

type PlanWeekCardProps = {
  /** Defaults to "Plan your week". */
  title?: string;
  /** Defaults to "<plan length> days, one grocery list". */
  subtitle?: string;
  /** The three photos (e.g. today's planned meals). Defaults to three
   *  home-cooked meals from the catalog, a different three each day. */
  photos?: (ImageSource | number)[];
  /** Beside the title. Defaults to the PRO badge. */
  badge?: ReactNode;
  /** Under the row, inside the card (e.g. a goal bar). */
  footer?: ReactNode;
  /** Defaults to opening the Meal Planner. */
  onPress?: () => void;
  accessibilityLabel?: string;
};

// Meal Planner's way in on Home (see HomePlanCard for which version shows):
// three overlapping meal photos, the title and a line under it, one arrow.
// Soft placeholders until the photos load.
function PlanWeekCardInner({ title = "Plan your week", subtitle, photos: given, badge, footer, onPress, accessibilityLabel }: PlanWeekCardProps) {
  const { data: meals } = useRealMeals();
  // The plan length you'd get: Pro's choice in Settings, else 5.
  const isPro = useIsPro();
  const { prefs } = usePreferences();
  const days = isPro ? prefs.planner_defaults.days : 5;

  const catalogPhotos = useMemo(() => {
    const withPhotos = (meals ?? []).filter((m) => m.image_url && m.category !== "fast_food");
    if (withPhotos.length === 0) return [];
    const dayOffset = Math.floor(Date.now() / 86_400_000) % withPhotos.length;
    return Array.from({ length: Math.min(PHOTO_COUNT, withPhotos.length) }, (_, i) => ({
      uri: withPhotos[(dayOffset + i) % withPhotos.length].image_url as string,
    }));
  }, [meals]);
  const photos = given ?? catalogPhotos;
  const line = subtitle ?? `${days} days, one grocery list`;

  return (
    <Pressable
      onPress={onPress ?? (() => router.push("/meal-planner"))}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${title}, a Pro feature. ${line}.`}
      className="gap-3 rounded-2xl border border-ink-emphasis/10 px-4 py-3.5 active:opacity-70"
    >
      <View className="flex-row items-center gap-4">
        <View className="flex-row">
          {Array.from({ length: PHOTO_COUNT }, (_, i) => (
            <View
              key={i}
              className="overflow-hidden rounded-full border-2 border-white bg-ink-emphasis/5"
              style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, marginLeft: i === 0 ? 0 : -PHOTO_OVERLAP, zIndex: PHOTO_COUNT - i }}
            >
              {photos[i] != null && <Image source={photos[i]} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} />}
            </View>
          ))}
        </View>

        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="font-inter-bold text-subheading text-ink-emphasis">
              {title}
              <Text className="text-accent">.</Text>
            </Text>
            {badge === undefined ? <ProBadge /> : badge}
          </View>
          <Text className="font-inter-regular text-body text-ink-subtle">{line}</Text>
        </View>

        <ArrowRight color={colors.ink.subtle} size={18} />
      </View>
      {footer}
    </Pressable>
  );
}

// Skips Home's re-renders (any route change re-renders Home, which reads
// its URL params), unless its own props change.
export const PlanWeekCard = memo(PlanWeekCardInner);
