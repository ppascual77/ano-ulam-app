import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import { Gift } from "lucide-react-native";
import { AppText, BottomSheet, PulsePressable } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { usePaysForPro } from "@/frontend/core/pro/store/useProStore";
import { useProRewardProgress } from "@/frontend/core/pro/hooks/useProRewardProgress";
import { POST_REWARD_DAYS, RECIPE_REWARD_DAYS } from "@/frontend/core/pro/proContent";

export type CreateChoice = "post" | "recipe";

type CreateSheetProps = {
  visible: boolean;
  onClose: () => void;
  onChoose: (choice: CreateChoice) => void;
  /** Fires once the close animation finishes: open the next sheet from here
   *  so two Modals are never presented at once (see BottomSheet). */
  onClosed?: () => void;
};

const EASE = Easing.out(Easing.cubic);
// The timeline, in ms from the sheet opening: the header, then the cards
// one after another, then each unclaimed reward's gift gives one wiggle.
const T = { header: 60, card: 160, cardStagger: 80, wiggle: 560 };

type Option = {
  choice: CreateChoice;
  tone: "primary" | "accent";
  title: string;
  pitch: string;
  reward: (days: number) => string;
};

const OPTIONS: Option[] = [
  {
    choice: "post",
    tone: "primary",
    title: "Share a food post",
    pitch: "Your plate, a palengke find, a budget win. Show the community what you're eating.",
    reward: (days) => `Your first photo post earns ${days} days of Pro`,
  },
  {
    choice: "recipe",
    tone: "accent",
    title: "Add a recipe",
    pitch: "Your go-to ulam, priced in pesos with macros, ready for anyone to cook.",
    reward: (days) => `Your first approved recipe earns ${days} days of Pro, after a quick review`,
  },
];

// The gift on a reward strip: one small wiggle once its card has landed.
function WigglingGift({ delay, reduceMotion }: { delay: number; reduceMotion: boolean }) {
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    turn.value = withDelay(
      delay,
      withSequence(
        withTiming(-14, { duration: 90 }),
        withTiming(12, { duration: 110 }),
        withTiming(-6, { duration: 90 }),
        withTiming(0, { duration: 110, easing: EASE }),
      ),
    );
    // Once, as the sheet opens.
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <Gift color={colors.accent} size={14} strokeWidth={2.5} />
    </Animated.View>
  );
}

function OptionCard({
  option,
  index,
  rewardDays,
  reduceMotion,
  onPress,
}: {
  option: Option;
  index: number;
  rewardDays: number | null;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  const accent = option.tone === "accent";
  const entering = reduceMotion ? FadeIn.duration(200) : FadeInDown.delay(T.card + index * T.cardStagger).duration(360).easing(EASE);
  return (
    <Animated.View entering={entering}>
      <PulsePressable
        onPress={onPress}
        radius={16}
        ringColor={accent ? colors.accent : colors.primary}
        pulse="subtle"
        accessibilityRole="button"
        accessibilityLabel={`${option.title}. ${option.pitch}${rewardDays ? ` ${option.reward(rewardDays)}.` : ""}`}
      >
        <View className="overflow-hidden rounded-2xl border border-ink-emphasis/10 bg-white">
          <View className="flex-row items-center gap-3 p-4">
            <View className="flex-1">
              <Text className="font-inter-bold text-body text-ink-emphasis">{option.title}</Text>
              <Text className="mt-0.5 font-inter-regular text-small text-ink-subtle">{option.pitch}</Text>
            </View>
          </View>
          {rewardDays !== null && (
            <View className="flex-row items-center gap-2 border-t border-accent/15 bg-accent/5 px-4 py-2.5">
              <WigglingGift delay={T.wiggle + index * T.cardStagger} reduceMotion={reduceMotion} />
              <Text className="flex-1 font-inter-semibold text-small text-accent">{option.reward(rewardDays)}</Text>
            </View>
          )}
        </View>
      </PulsePressable>
    </Animated.View>
  );
}

// "Create", opened by the Create button's second tap: a line on why it
// matters, then the two things to make as cards, each with a pitch and,
// while its Pro reward is still unclaimed, a reward strip (shown on earned
// Pro and during a free trial, since earned days still count there; not
// to paying subscribers, where earned
// days would only overlap the Pro they pay for). With both rewards open, a
// pill adds them up.
export function CreateSheet({ visible, onClose, onChoose, onClosed }: CreateSheetProps) {
  const reduceMotion = useReduceMotion();
  const subscribed = usePaysForPro();
  const { data: progress, refetch: refetchRewards } = useProRewardProgress();
  // Fresh on every open: a reward granted (or reset) since the last check
  // shows straight away.
  useEffect(() => {
    if (visible) void refetchRewards();
  }, [visible]);
  const rewardDays = (choice: CreateChoice): number | null => {
    if (subscribed) return null;
    if (choice === "post") return progress?.hasPhotoPost ? null : POST_REWARD_DAYS;
    return (progress?.approvedRecipes ?? 0) > 0 ? null : RECIPE_REWARD_DAYS;
  };
  const postDays = rewardDays("post");
  const recipeDays = rewardDays("recipe");
  // Bumped on each open, so the entrance replays then (and never while the
  // sheet slides away).
  const [opens, setOpens] = useState(0);
  useEffect(() => {
    if (visible) setOpens((n) => n + 1);
  }, [visible]);

  return (
    <BottomSheet visible={visible} onClose={onClose} onClosed={onClosed} heightPercent={0.75} fitContent>
      <View key={opens} className="px-6 pb-8 pt-12">
        <Animated.View entering={reduceMotion ? FadeIn.duration(200) : FadeInDown.delay(T.header).duration(320).easing(EASE)}>
          <AppText variant="sectionTitle" dot>
            Create
          </AppText>
          <Text className="mt-1 font-inter-regular text-body text-ink-subtle">
            Share what&apos;s cooking and help someone answer &quot;ano ulam?&quot; today.
          </Text>
          {postDays !== null && recipeDays !== null && (
            <View className="mt-3 flex-row items-center gap-1.5 self-start rounded-full bg-accent/10 px-3 py-1.5">
              <Gift color={colors.accent} size={13} strokeWidth={2.5} />
              <Text className="font-inter-bold text-sub text-accent">Up to {postDays + recipeDays} days of Pro, free</Text>
            </View>
          )}
        </Animated.View>

        <View className="mt-5 gap-3">
          {OPTIONS.map((option, i) => (
            <OptionCard
              key={option.choice}
              option={option}
              index={i}
              rewardDays={option.choice === "post" ? postDays : recipeDays}
              reduceMotion={reduceMotion}
              onPress={() => onChoose(option.choice)}
            />
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}
