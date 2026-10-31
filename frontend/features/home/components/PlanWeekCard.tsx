import { memo, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { ProBadge } from "@/frontend/core/pro/components/ProBadge";
import { useRealMeals } from "@/frontend/core/meals/hooks/useRealMeals";

const PHOTO_COUNT = 3;
const PHOTO_SIZE = 44;
const PHOTO_OVERLAP = 14;

// Meal Planner's way in, since Profile took its bottom nav tab: planning is
// a weekly (Pro) task, not a daily destination.
//
// Led by real food: three overlapping photos of home-cooked meals from the
// catalog (a different three each day, steady within the day), then the
// title and one arrow. Soft placeholders until the catalog loads.
// TODO: gate behind Pro (useProStore's isPro / the planner's locked
// state) once Pro is decided; for now it just opens the planner.
function PlanWeekCardInner() {
  const { data: meals } = useRealMeals();

  const photos = useMemo(() => {
    const withPhotos = (meals ?? []).filter((m) => m.image_url && m.category !== "fast_food");
    if (withPhotos.length === 0) return [];
    const dayOffset = Math.floor(Date.now() / 86_400_000) % withPhotos.length;
    return Array.from({ length: Math.min(PHOTO_COUNT, withPhotos.length) }, (_, i) => withPhotos[(dayOffset + i) % withPhotos.length].image_url as string);
  }, [meals]);

  return (
    <Pressable
      onPress={() => router.push("/meal-planner")}
      accessibilityRole="button"
      accessibilityLabel="Plan your week, a Pro feature. Meals and one grocery list for 7 days, built around your budget."
      className="flex-row items-center gap-4 rounded-2xl border border-ink-emphasis/10 px-4 py-3.5 active:opacity-70"
    >
      <View className="flex-row">
        {Array.from({ length: PHOTO_COUNT }, (_, i) => (
          <View
            key={i}
            className="overflow-hidden rounded-full border-2 border-white bg-ink-emphasis/5"
            style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, marginLeft: i === 0 ? 0 : -PHOTO_OVERLAP, zIndex: PHOTO_COUNT - i }}
          >
            {photos[i] && <Image source={{ uri: photos[i] }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} />}
          </View>
        ))}
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="font-inter-bold text-subheading text-ink-emphasis">
            Plan your week<Text className="text-accent">.</Text>
          </Text>
          <ProBadge />
        </View>
        <Text className="font-inter-regular text-body text-ink-subtle">7 days, one grocery list</Text>
      </View>

      <ArrowRight color={colors.ink.subtle} size={18} />
    </Pressable>
  );
}

// Skips Home's re-renders (any route change re-renders Home, which reads
// its URL params), unless its own props change.
export const PlanWeekCard = memo(PlanWeekCardInner);
