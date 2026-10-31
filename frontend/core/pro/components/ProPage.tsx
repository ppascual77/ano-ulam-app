import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { ArrowRight, Check, Minus, X } from "lucide-react-native";
import { AppText, Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { ProBadge } from "./ProBadge";
import { useIsPro, useProStore } from "../store/useProStore";
import {
  COMPARE_ROWS,
  PLANS,
  QUOTES,
  RADAR,
  TRIAL_DAYS,
  YEARLY_SAVE_PCT,
  type CompareCell,
  type PlanKey,
} from "../proContent";

type ProPageProps = {
  onClose: () => void;
  /** Pro has just been switched on (the trial started): toast and close. */
  onStarted: () => void;
};

// The full Pro page (ProUpgradeSheet is the quick version, and links here):
// the promise, press, Free vs Pro, a plan, then what people say. The button
// stays pinned at the bottom while the rest scrolls. Shown as the /pro
// screen, and inside the meal sheet (a screen can't open over it). The
// caller handles the safe area.
export function ProPage({ onClose, onStarted }: ProPageProps) {
  const isPro = useIsPro();
  const setPro = useProStore((s) => s.setPro);
  const [plan, setPlan] = useState<PlanKey>("monthly");
  const chosen = PLANS[plan];

  const start = () => {
    // MOCK: no subscriptions yet, same test unlock as the sheet.
    setPro(true);
    onStarted();
  };

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-6 pb-2 pt-1">
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-full bg-ink-emphasis/5 active:opacity-60"
        >
          <X color={colors.ink.emphasis} size={20} />
        </Pressable>
        <ProBadge />
      </View>

      <ScrollView contentContainerClassName="gap-8 px-6 pb-8 pt-2" showsVerticalScrollIndicator={false}>
        <View>
          <AppText variant="sectionTitle" dot>
            AnoUlam Pro
          </AppText>
          <Text className="mt-2 font-inter-regular text-body text-ink-subtle">Plan the week, spend less, and eat your way.</Text>
        </View>

        <RadarFeature />
        <CompareTable />
        <PlanPicker plan={plan} onChange={setPlan} />
        <Quotes />
      </ScrollView>

      <View className="gap-3 border-t border-ink-emphasis/10 px-6 pb-2 pt-4">
        {isPro ? (
          <Button label="You have Pro" variant="secondary" disabled />
        ) : (
          <>
            <Text className="text-center font-inter-regular text-small text-ink-subtle">
              {TRIAL_DAYS} days free, then ₱{chosen.price}/{chosen.per}. Cancel anytime.
            </Text>
            <Button label={`Start ${TRIAL_DAYS}-day free trial`} variant="secondary" onPress={start} />
          </>
        )}
      </View>
    </View>
  );
}

// "Featured on Radar": their logo (navy is part of the image) and headline,
// opening the article.
function RadarFeature() {
  return (
    <Pressable
      onPress={() => void Linking.openURL(RADAR.url)}
      accessibilityRole="link"
      accessibilityLabel={`Featured on Radar: ${RADAR.headline}. Read the article.`}
      className="gap-3 rounded-2xl border border-ink-emphasis/10 p-4 active:opacity-70"
    >
      <View className="flex-row items-center gap-2">
        <AppText variant="eyebrow" className="text-sub">
          Featured on
        </AppText>
        <Image source={require("@/assets/pro/radar-logo.png")} style={{ width: 58, height: 20, borderRadius: 4 }} contentFit="cover" />
      </View>
      <Text className="font-inter-semibold text-body text-ink-emphasis">{RADAR.headline}</Text>
      <View className="flex-row items-center gap-1">
        <Text className="font-inter-medium text-small text-primary">Read the article</Text>
        <ArrowRight color={colors.primary} size={14} />
      </View>
    </Pressable>
  );
}

function Cell({ value, pro }: { value: CompareCell; pro?: boolean }) {
  if (value === true) return <Check color={pro ? colors.accent : colors.primary} size={18} strokeWidth={3} />;
  if (value === false) return <Minus color={colors.ink.placeholder} size={16} />;
  return (
    <Text className={`text-center font-inter-semibold text-small ${pro ? "text-accent" : "text-ink-subtle"}`} numberOfLines={1}>
      {value}
    </Text>
  );
}

// Free vs Pro, with the Pro column tinted orange top to bottom.
function CompareTable() {
  return (
    <View className="gap-3">
      <AppText variant="sectionSubtitle" dot>
        Free vs Pro
      </AppText>
      {/* No grid: whitespace lines the rows up, and the Pro column is one
          soft orange band behind its cells. */}
      <View>
        <View pointerEvents="none" className="absolute bottom-0 right-0 top-0 w-20 rounded-2xl bg-accent/5" />
        <View className="flex-row items-center">
          <View className="flex-1" />
          <View className="w-20 items-center py-3">
            <Text className="font-inter-bold text-small text-ink-subtle">Free</Text>
          </View>
          <View className="w-20 items-center py-3">
            <ProBadge />
          </View>
        </View>
        {COMPARE_ROWS.map((row) => (
          <View key={row.label} className="flex-row items-stretch">
            <Text className="flex-1 py-3 pr-2 font-inter-medium text-body text-ink-emphasis">{row.label}</Text>
            <View className="w-20 items-center justify-center py-3">
              <Cell value={row.free} />
            </View>
            <View className="w-20 items-center justify-center py-3">
              <Cell value={row.pro} pro />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function PlanPicker({ plan, onChange }: { plan: PlanKey; onChange: (plan: PlanKey) => void }) {
  return (
    <View className="gap-3">
      <AppText variant="sectionSubtitle" dot>
        Pick your plan
      </AppText>
      {/* Extra top room for the yearly card's "Save" tag. */}
      <View className="flex-row gap-3 pt-2">
        {(Object.keys(PLANS) as PlanKey[]).map((key) => (
          <PlanCard
            key={key}
            planKey={key}
            selected={plan === key}
            onPress={() => {
              if (plan === key) return;
              void Haptics.selectionAsync();
              onChange(key);
            }}
          />
        ))}
      </View>
    </View>
  );
}

// Selection colors, from the brand tokens with alpha (hex suffix), since
// interpolateColor needs raw values.
const CARD_BORDER = { off: `${colors.ink.emphasis}1F`, on: colors.primary };
const CARD_FILL = { off: colors.white, on: `${colors.primary}0D` };
const RADIO_RING = { off: `${colors.ink.emphasis}33`, on: colors.primary };
const SELECT_MS = 220;

// One plan. The border is always 2px (only its color changes), so selecting
// never shifts the layout. Selecting fades the border and fill in, pops the
// radio's dot in and gives the card a small press-and-settle.
function PlanCard({ planKey, selected, onPress }: { planKey: PlanKey; selected: boolean; onPress: () => void }) {
  const option = PLANS[planKey];
  const on = useSharedValue(selected ? 1 : 0);
  const press = useSharedValue(1);
  useEffect(() => {
    on.value = withTiming(selected ? 1 : 0, { duration: SELECT_MS, easing: Easing.out(Easing.cubic) });
    if (selected) press.value = withSequence(withTiming(0.97, { duration: 90 }), withSpring(1, { damping: 12, stiffness: 260, mass: 0.6 }));
  }, [selected, on, press]);

  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(on.value, [0, 1], [CARD_BORDER.off, CARD_BORDER.on]),
    backgroundColor: interpolateColor(on.value, [0, 1], [CARD_FILL.off, CARD_FILL.on]),
    transform: [{ scale: press.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(on.value, [0, 1], [RADIO_RING.off, RADIO_RING.on]),
  }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: on.value, transform: [{ scale: on.value }] }));

  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} className="flex-1">
      <Animated.View style={[{ borderWidth: 2 }, cardStyle]} className="flex-1 rounded-2xl px-4 py-4">
        {planKey === "yearly" && (
          <View className="absolute -top-3 right-3 rounded-full bg-accent px-2 py-1">
            <Text className="font-inter-extrabold text-sub text-white">SAVE {YEARLY_SAVE_PCT}%</Text>
          </View>
        )}
        <View className="flex-row items-center gap-2">
          <Animated.View style={[{ borderWidth: 2 }, ringStyle]} className="h-5 w-5 items-center justify-center rounded-full">
            <Animated.View style={dotStyle} className="h-2.5 w-2.5 rounded-full bg-primary" />
          </Animated.View>
          <Text className="font-inter-semibold text-body text-ink-emphasis">{option.label}</Text>
        </View>
        <Text className="mt-3 font-inter-extrabold text-heading text-ink-emphasis">
          ₱{option.price}
          <Text className="font-inter-regular text-small text-ink-subtle">/{option.per}</Text>
        </Text>
        {planKey === "yearly" && <Text className="font-inter-regular text-small text-ink-subtle">₱{Math.round(option.price / 12)} a month</Text>}
      </Animated.View>
    </Pressable>
  );
}

// Real comments about AnoUlam (the free web app), so the title doesn't call
// them Pro reviews.
function Quotes() {
  return (
    <View className="gap-3">
      <AppText variant="sectionSubtitle" dot>
        What people say about AnoUlam
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6" contentContainerClassName="gap-3 px-6">
        {QUOTES.map((quote) => (
          <View key={quote.author} className="w-64 justify-between gap-3 rounded-2xl border border-ink-emphasis/10 p-4">
            <View>
              <Text className="font-inter-extrabold text-heading text-accent">{"“"}</Text>
              <Text className="font-inter-regular text-body text-ink-emphasis">{quote.text}</Text>
            </View>
            <Text className="font-inter-medium text-small text-ink-subtle">u/{quote.author} on Reddit</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
