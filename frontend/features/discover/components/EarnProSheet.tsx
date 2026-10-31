import { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { Camera, ChefHat, type LucideIcon } from "lucide-react-native";
import { AppText, BottomSheet, Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { POST_REWARD_DAYS, RECIPE_REWARD_DAYS, RECIPE_REWARD_MAX } from "@/frontend/core/pro/proContent";

export type EarnProChoice = "recipe" | "post";

type EarnProSheetProps = {
  visible: boolean;
  /** Hide it (an action was picked, or it was swiped down / tapped outside). */
  onClose: () => void;
  /** Once it has fully closed: what was picked, or null if it was just
   *  dismissed. Open the next screen or sheet here, never under it. */
  onClosed: (choice: EarnProChoice | null) => void;
};

const TOTAL_DAYS = RECIPE_REWARD_DAYS * RECIPE_REWARD_MAX + POST_REWARD_DAYS;

function RewardRow({ icon: Icon, title, days, detail }: { icon: LucideIcon; title: string; days: number; detail: string }) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-4">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-accent/10">
        <Icon color={colors.accent} size={18} />
      </View>
      <View className="flex-1">
        <Text className="font-inter-semibold text-body text-ink-emphasis">{title}</Text>
        <Text className="font-inter-regular text-small text-ink-subtle">{detail}</Text>
      </View>
      <View className="rounded-full bg-accent/10 px-2.5 py-1">
        <Text className="font-inter-bold text-small text-accent">{days} days</Text>
      </View>
    </View>
  );
}

// Discover, for signed-in free users after a few reels: sharing earns Pro
// time. Says up front what earns what, how many times, and that recipes
// count once approved.
export function EarnProSheet({ visible, onClose, onClosed }: EarnProSheetProps) {
  const choice = useRef<EarnProChoice | null>(null);
  const pick = (next: EarnProChoice) => {
    choice.current = next;
    onClose();
  };

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
            <RewardRow
              icon={ChefHat}
              title="Add a recipe"
              days={RECIPE_REWARD_DAYS}
              detail={`Once it's approved. Up to ${RECIPE_REWARD_MAX} recipes, so ${RECIPE_REWARD_DAYS * RECIPE_REWARD_MAX} days.`}
            />
            <View className="border-t border-ink-emphasis/10">
              <RewardRow icon={Camera} title="Share a food post" days={POST_REWARD_DAYS} detail="Your first post with a photo. One time." />
            </View>
          </View>
          <Text className="text-center font-inter-medium text-small text-ink-subtle">Up to {TOTAL_DAYS} days of Pro, free.</Text>
        </View>

        <View className="gap-4">
          <Button label="Add a recipe" onPress={() => pick("recipe")} />
          <Pressable onPress={() => pick("post")} hitSlop={8} className="items-center active:opacity-60">
            <Text className="font-inter-semibold text-body text-primary">Share a food post</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}
