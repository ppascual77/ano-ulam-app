import { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { Camera, Check, ChefHat, type LucideIcon } from "lucide-react-native";
import { AppText, BottomSheet, Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { ProRewardProgress } from "@/api/proRewards";
import { POST_REWARD_DAYS, RECIPE_REWARD_DAYS } from "@/frontend/core/pro/proContent";

export type EarnProChoice = "recipe" | "post";

type EarnProSheetProps = {
  visible: boolean;
  /** What the user has already done (from the database); null while it loads. */
  progress: ProRewardProgress | null;
  /** Hide it (an action was picked, or it was swiped down / tapped outside). */
  onClose: () => void;
  /** Once it has fully closed: what was picked, or null if it was just
   *  dismissed. Open the next screen or sheet here, never under it. */
  onClosed: (choice: EarnProChoice | null) => void;
};

function RewardRow({
  icon: Icon,
  title,
  days,
  detail,
  done,
}: {
  icon: LucideIcon;
  title: string;
  days: number;
  detail: string;
  done: boolean;
}) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-4">
      <View className={`h-10 w-10 items-center justify-center rounded-full ${done ? "bg-primary/10" : "bg-accent/10"}`}>
        {done ? <Check color={colors.primary} size={18} strokeWidth={3} /> : <Icon color={colors.accent} size={18} />}
      </View>
      <View className="flex-1">
        <Text className="font-inter-semibold text-body text-ink-emphasis">{title}</Text>
        <Text className="font-inter-regular text-small text-ink-subtle">{detail}</Text>
      </View>
      <View className={`rounded-full px-2.5 py-1 ${done ? "bg-primary/10" : "bg-accent/10"}`}>
        <Text className={`font-inter-bold text-small ${done ? "text-primary" : "text-accent"}`}>{done ? "Done" : `${days} days`}</Text>
      </View>
    </View>
  );
}

// Discover, for signed-in free users after a few reels: sharing earns Pro
// time. Says up front what earns what (once each) and that a recipe counts
// once approved, then where the user already stands: recipe approved or
// not, photo post done or not, and only the days still to earn.
export function EarnProSheet({ visible, progress, onClose, onClosed }: EarnProSheetProps) {
  const choice = useRef<EarnProChoice | null>(null);
  const pick = (next: EarnProChoice) => {
    choice.current = next;
    onClose();
  };

  // One claim each: the first approved recipe, the first photo post.
  const recipesDone = (progress?.approvedRecipes ?? 0) > 0;
  const postDone = progress?.hasPhotoPost ?? false;
  const daysLeft = (recipesDone ? 0 : RECIPE_REWARD_DAYS) + (postDone ? 0 : POST_REWARD_DAYS);
  const recipeDetail = recipesDone ? "Your recipe was approved." : "Once your first recipe is approved.";

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onClosed={() => {
        const picked = choice.current;
        choice.current = null;
        onClosed(picked);
      }}
      heightPercent={0.85}
      fitContent
    >
      <View className="gap-6 px-6 pb-8 pt-10">
        <View className="gap-2">
          <AppText variant="sectionTitle" dot>
            Your recipe could earn you Pro
          </AppText>
          <Text className="font-inter-regular text-body text-ink-subtle">
            Every recipe you share helps someone answer &quot;ano ulam?&quot; today. We&apos;ll thank you with Pro.
          </Text>
        </View>

        <View className="gap-3">
          <View className="rounded-2xl border border-ink-emphasis/10">
            <RewardRow icon={ChefHat} title="Add a recipe" days={RECIPE_REWARD_DAYS} detail={recipeDetail} done={recipesDone} />
            <View className="border-t border-ink-emphasis/10">
              <RewardRow
                icon={Camera}
                title="Share a food post"
                days={POST_REWARD_DAYS}
                detail={postDone ? "Your photo post is in." : "Your first post with a photo. One time."}
                done={postDone}
              />
            </View>
          </View>
          <Text className="text-center font-inter-medium text-small text-ink-subtle">
            {recipesDone || postDone ? `Up to ${daysLeft} more days of Pro, free.` : `Up to ${daysLeft} days of Pro, free.`}
          </Text>
        </View>

        {/* Only what's still left to do: the first open action leads. */}
        <View className="gap-4">
          {!recipesDone && <Button label="Add a recipe" onPress={() => pick("recipe")} />}
          {!postDone &&
            (recipesDone ? (
              <Button label="Share a food post" onPress={() => pick("post")} />
            ) : (
              <Pressable onPress={() => pick("post")} hitSlop={8} className="items-center active:opacity-60">
                <Text className="font-inter-semibold text-body text-primary">Share a food post</Text>
              </Pressable>
            ))}
        </View>
      </View>
    </BottomSheet>
  );
}
