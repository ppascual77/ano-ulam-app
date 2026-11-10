import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Lock } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import type { MealType } from "@/frontend/core/meals/mealTypes";

type SeeAllMatchesCardProps = {
  /** How many results are past the free cap. */
  hiddenCount: number;
  /** The locked meals; the first is shown blurred, so "+5 more" reads as
   *  real meals (a photo only, nothing readable). */
  preview?: MealType[];
  /** "card": a meal card's size, at the end of a carousel (stretched to the
   *  row's height). "row": full width, under a list (Pantry, See All). */
  variant?: "card" | "row";
  /** The carousel's card width ("card" only). */
  width?: number;
};

// One locked meal peeks through, blurred (three side by side read as
// glitchy).
const BLUR = 18;
const THUMB = 40;

// Where a free account's results stop (FREE_RESULTS_CAP): in place of "Show
// More", a Pro card over the next locked meal's photo, blurred (a
// Mobbin-style peek), "See every match with Pro" and how many more there
// are. Opens the Pro page titled for it. Searches still count once each,
// so this is about depth, not how often.
export function SeeAllMatchesCard({ hiddenCount, preview = [], variant = "card", width }: SeeAllMatchesCardProps) {
  const peek = preview[0];
  const open = () =>
    router.push({
      pathname: "/pro",
      params: { title: "See every", highlight: "match", subtitle: "Free shows the first results of each search. Pro shows them all." },
    });
  const more = `+${hiddenCount} more ${hiddenCount === 1 ? "meal" : "meals"}`;
  const label = `See every match with Pro, ${more}`;

  if (variant === "row") {
    return (
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="mt-4 flex-row items-center gap-3 rounded-2xl bg-accent/5 px-4 py-3.5 active:opacity-80"
      >
        {peek ? (
          // The first locked meal as a blurred thumbnail, the lock on its
          // corner.
          <View style={{ width: THUMB, height: THUMB }}>
            <View style={{ width: THUMB, height: THUMB }} className="overflow-hidden rounded-xl bg-ink-emphasis/5">
              <Image source={resolveMealImage(peek)} blurRadius={BLUR} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            </View>
            <View className="absolute -bottom-1 -right-1 h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-accent">
              <Lock color={colors.white} size={9} strokeWidth={2.5} />
            </View>
          </View>
        ) : (
          <View className="h-9 w-9 items-center justify-center rounded-full bg-accent">
            <Lock color={colors.white} size={15} strokeWidth={2.5} />
          </View>
        )}
        <View className="flex-1">
          <Text className="font-inter-bold text-body text-ink-emphasis">See every match with Pro</Text>
          <Text className="font-inter-semibold text-small text-accent">{more}</Text>
        </View>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width }}
      className="flex-1 overflow-hidden rounded-2xl bg-accent/5 active:opacity-80"
    >
      {/* The first locked meal's photo, blurred, filling the card under a
          light wash so the card's words stay readable. */}
      {peek && (
        <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 top-0">
          <Image source={resolveMealImage(peek)} blurRadius={BLUR} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          <View className="absolute bottom-0 left-0 right-0 top-0 bg-white/70" />
        </View>
      )}
      <View className="flex-1 items-center justify-center gap-3 px-5">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-accent">
          <Lock color={colors.white} size={18} strokeWidth={2.5} />
        </View>
        <Text className="text-center font-inter-bold text-body text-ink-emphasis">See every match with Pro</Text>
        <Text className="font-inter-semibold text-small text-accent">{more}</Text>
      </View>
    </Pressable>
  );
}
