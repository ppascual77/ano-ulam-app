import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { CalendarDays, EyeOff, Infinity as InfinityIcon, TrendingDown } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { ProNameBadge } from "@/frontend/core/pro/components/ProProfileFlair";
import { COMPARE_ROWS, PLANS, TRIAL_DAYS, YEARLY_SAVE_PCT } from "@/frontend/core/pro/proContent";
import { useProStore } from "@/frontend/core/pro/store/useProStore";
import { commodityShortName, useBiggestPriceDrop } from "@/frontend/core/prices/hooks/useBiggestPriceDrop";
import { useSavedMeals } from "@/frontend/core/saved/hooks/useSavedMeals";
import { SAVED_MEALS_LIMIT } from "@/frontend/core/saved/types";

// The card's green: the header green deepening to the bottom right.
const CARD_GREEN = [colors.primary, colors.home.top, colors.brandGreen.dark] as const;
const ICON = 15;
// How many benefits the card lists (the rest are counted in "+ N more").
const SHOWN_BENEFITS = 4;

// One benefit: an icon in a soft circle, the benefit, and a line about you
// under it. Icons and text sit on one grid (28px icon column, 12px gap).
function Benefit({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="-mt-1 h-7 w-7 items-center justify-center rounded-full bg-white/15">{icon}</View>
      <View className="flex-1">
        <Text className="font-inter-bold text-body text-white">{title}</Text>
        <Text className="mt-0.5 font-inter-regular text-small text-home-name">{detail}</Text>
      </View>
    </View>
  );
}

// Settings' pitch for a free account: what Pro adds, said about you (how
// many saves you've used, this week's real price drop), the free trial when
// your Apple ID can still get one, and the price from the App Store. The
// PRO badge glints like the one on a Pro profile (once, then every 10 s;
// still with Reduce motion). Opens the Pro page.
export function ProPitchCard() {
  const { data: saved = [] } = useSavedMeals();
  const drop = useBiggestPriceDrop();
  const prices = useProStore((s) => s.prices);
  const trialEligible = useProStore((s) => s.trialEligible);
  const hasTrial = trialEligible.yearly !== false && trialEligible.monthly !== false;
  const monthly = prices.monthly ?? `₱${PLANS.monthly.price}`;
  const yearly = prices.yearly ?? `₱${PLANS.yearly.price}`;
  const used = Math.min(saved.length, SAVED_MEALS_LIMIT);
  // The Pro page's rows Pro improves, past the four shown here.
  const moreCount = COMPARE_ROWS.filter((r) => r.free !== r.pro && r.free !== true).length - SHOWN_BENEFITS;

  return (
    <View className="overflow-hidden rounded-3xl shadow-lg">
      <LinearGradient colors={CARD_GREEN} start={{ x: 1, y: 0 }} end={{ x: 0.2, y: 1 }} style={{ padding: 20 }}>
        <View className="flex-row items-center gap-2">
          <Text className="font-inter-bold text-sub uppercase tracking-widest text-home-name">AnoUlam</Text>
          <ProNameBadge />
        </View>
        <Text className="mt-2 font-inter-extrabold text-heading tracking-display text-white">
          Cook smarter,{"\n"}spend less<Text className="text-accent">.</Text>
        </Text>
        {/* So the list reads as what Pro adds, not as all there is. */}
        <Text className="mt-2 font-inter-regular text-small text-home-name">
          Everything in Free stays free. Pro adds:
        </Text>

        <View className="mt-4 gap-4">
          <Benefit
            icon={<InfinityIcon color={colors.white} size={ICON} strokeWidth={2.5} />}
            title="Unlimited saved meals"
            detail={used > 0 ? `You've used ${used} of your ${SAVED_MEALS_LIMIT}` : `Free keeps ${SAVED_MEALS_LIMIT}`}
          />
          <Benefit
            icon={<CalendarDays color={colors.white} size={ICON} strokeWidth={2.5} />}
            title="7-day meal plans"
            detail="One grocery list for the whole week"
          />
          <Benefit
            icon={<TrendingDown color={colors.white} size={ICON} strokeWidth={2.5} />}
            title="Price drop alerts"
            detail={
              drop
                ? `${commodityShortName(drop)} is ${Math.round(Math.abs(drop.pctChange ?? 0))}% cheaper this week`
                : "A push the day an ingredient gets cheaper"
            }
          />
          <Benefit
            icon={<EyeOff color={colors.white} size={ICON} strokeWidth={2.5} />}
            title="Hide ingredients you don't eat"
            detail="Everywhere in the app, not just allergens"
          />
        </View>
        {moreCount > 0 && (
          <Text className="ml-10 mt-3 font-inter-semibold text-small text-home-name">+ {moreCount} more, like meal swaps and full nutrients</Text>
        )}

        <Pressable
          onPress={() => router.push("/pro")}
          accessibilityRole="button"
          className="mt-5 items-center rounded-full bg-white py-3.5 active:opacity-90"
        >
          <Text className="font-inter-extrabold text-body-lg text-home-top">
            {hasTrial ? `Try Pro free for ${TRIAL_DAYS} days` : "Get Pro"}
          </Text>
        </Pressable>
        <Text className="mt-2.5 text-center font-inter-regular text-sub leading-4 text-home-name">
          {hasTrial ? "Then " : ""}
          {monthly}/month or {yearly}/year (save {YEARLY_SAVE_PCT}%).{"\n"}Cancel anytime.
        </Text>
        <Pressable onPress={() => router.push("/pro")} hitSlop={8} accessibilityRole="link" className="mt-3 self-center active:opacity-70">
          <Text className="font-inter-bold text-small text-white underline">Compare Free and Pro</Text>
        </Pressable>
      </LinearGradient>
    </View>
  );
}
