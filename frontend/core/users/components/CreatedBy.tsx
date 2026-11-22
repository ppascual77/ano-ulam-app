import { Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "@/frontend/components/ui/Text";
import { Avatar } from "@/frontend/components/ui";
import { UNNAMED_USER } from "@/frontend/features/auth/hooks/useDisplayName";
import { usePosterProfile } from "../hooks/usePosterProfile";

// Shown when the profile can't be read (a guest): still says it's a person's.
const COMMUNITY_COOK = "Community cook";

type CreatedByProps = {
  posterId: string;
  /** "photo": white text over a photo (cards, the reel); "page": on white
   *  (Meal Details, under the name). */
  tone?: "photo" | "page";
  /** Smaller, for cards. */
  compact?: boolean;
  onPress?: () => void;
};

// "Created by <name>" with the poster's photo (initials without one), as the
// web app's MealPoster / Poster show it. A shimmer of the same size while the
// profile loads. Only for community recipes (official meals pass no poster).
export function CreatedBy({ posterId, tone = "photo", compact = false, onPress }: CreatedByProps) {
  const profile = usePosterProfile(posterId);
  const name = profile === null ? COMMUNITY_COOK : (profile?.displayName ?? UNNAMED_USER);
  const onPhoto = tone === "photo";
  const size = compact ? 20 : 26;

  const body =
    profile === undefined ? (
      <>
        <View className={`rounded-full ${onPhoto ? "bg-white/25" : "bg-ink-emphasis/10"}`} style={{ width: size, height: size }} />
        <View className="gap-1">
          <View className={`h-2 w-12 rounded ${onPhoto ? "bg-white/25" : "bg-ink-emphasis/10"}`} />
          <View className={`h-2.5 w-20 rounded ${onPhoto ? "bg-white/25" : "bg-ink-emphasis/10"}`} />
        </View>
      </>
    ) : (
      <>
        <Avatar name={name} imageUri={profile?.avatarUrl ?? undefined} size={size} />
        <View className="min-w-0 shrink">
          <Text className={`font-inter-regular text-sub ${onPhoto ? "text-white/70" : "text-ink-subtle"}`}>Created by</Text>
          <Text
            numberOfLines={1}
            className={`font-inter-semibold ${compact ? "text-small" : "text-body"} ${onPhoto ? "text-white" : "text-ink-emphasis"}`}
          >
            {name}
          </Text>
        </View>
      </>
    );

  const row = <View className="flex-row items-center gap-2">{body}</View>;
  if (!onPress) return row;
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Created by ${name}. Open profile`} className="self-start active:opacity-70">
      {row}
    </Pressable>
  );
}

/** The card's strip across the top of its photo: a soft dark gradient so
 *  white text reads over any photo, then CreatedBy. */
export function CreatedByStrip({ posterId }: { posterId: string }) {
  return (
    <View pointerEvents="none" className="absolute left-0 right-0 top-0">
      <LinearGradient colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0)"]} style={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: 18 }}>
        <View className="pr-12">
          <CreatedBy posterId={posterId} compact />
        </View>
      </LinearGradient>
    </View>
  );
}
