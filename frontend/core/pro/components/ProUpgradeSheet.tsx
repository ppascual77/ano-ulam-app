import { type ReactNode, useMemo, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { ArrowRight } from "lucide-react-native";
import { AppText, BoilingDoodle, BottomSheet, Button, drawBoilPair, type Doodle } from "@/frontend/components/ui";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { colors } from "@/frontend/constants/theme";
import { ProBadge } from "./ProBadge";

// What Pro gets you, grouped by the outcome (spend less, plan faster, eat
// your way) so each benefit reads as something it does for you, not a
// feature name.
// Hand-drawn marks for each group, in the app's doodle style (see
// components/ui/doodles): 24x24, jittered and boiled like the rest.
type Point = [number, number];
const ring = (cx: number, cy: number, r: number, steps: number): Point[] =>
  Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });

const GROUP_DOODLES = {
  // A coin with a peso sign.
  money: {
    strokes: [
      { points: ring(12, 12, 9.5, 18), closed: true },
      { points: [[10, 17], [10, 7]] },
      { points: [[10, 7], [13, 7], [15, 8.3], [15, 10.2], [13, 11.5], [10, 11.5]] },
      { points: [[7.5, 8.6], [16.5, 8.6]] },
      { points: [[7.5, 10.4], [16.5, 10.4]] },
    ],
  },
  // A clock at about ten past.
  time: {
    strokes: [{ points: ring(12, 12, 9.5, 18), closed: true }, { points: [[12, 6.5], [12, 12], [15.5, 14]] }],
    dots: [[12, 12, 1.1]],
  },
  // A steaming bowl.
  eat: {
    strokes: [
      { points: [[2.5, 12], [21.5, 12]] },
      { points: [[3, 12], [4.5, 16], [8, 19.2], [12, 20.2], [16, 19.2], [19.5, 16], [21, 12]] },
      { points: [[9, 9.5], [10.2, 7.8], [9, 6], [10.2, 4.2]] },
      { points: [[14.5, 9.5], [15.7, 7.8], [14.5, 6], [15.7, 4.2]] },
    ],
  },
} satisfies Record<string, Doodle>;

const GROUPS: { label: string; doodle: Doodle; benefits: { title: string; detail: string }[] }[] = [
  {
    label: "Save money",
    doodle: GROUP_DOODLES.money,
    benefits: [
      { title: "Price drop alerts", detail: "Know when what you buy gets cheaper" },
      { title: "See your savings", detail: "What you save each week, in pesos" },
    ],
  },
  {
    label: "Save time",
    doodle: GROUP_DOODLES.time,
    benefits: [
      { title: "Your whole week, planned", detail: "5 or 7 days of meals in your budget, swap any" },
      { title: "One grocery list", detail: "Everything for the week, in one list" },
    ],
  },
  {
    label: "Eat your way",
    doodle: GROUP_DOODLES.eat,
    benefits: [
      { title: "Ingredients to avoid", detail: "Meals without what you don't eat" },
      { title: "Nutrition goals", detail: "Your targets, plus fiber, sugar and sodium" },
    ],
  },
];

type ProUpgradeSheetProps = {
  visible: boolean;
  /** What was tapped, e.g. "Your next 4 days are ready". */
  title: ReactNode;
  body: string;
  onClose: () => void;
  /** "inline" when opened on top of another sheet (see BottomSheet's
   *  `presentation`), e.g. from inside a meal's detail sheet. */
  presentation?: "modal" | "inline";
  /** "Unlock Pro" and "See all Pro features" both lead to the full Pro page
   *  (plans live there): this closes the sheet, then calls this once it's
   *  fully gone, so the sheet never sits over what opens next. */
  onOpenPro: () => void;
};

// Tapping anything Pro without Pro: a light upsell, not a paywall. Used by
// the Meal Planner's locked days, Settings' Pro rows and locked
// micronutrients. The title and body speak to what was tapped; the
// benefits are the same everywhere. Swipe down or tap outside to dismiss.
export function ProUpgradeSheet({ visible, title, body, onClose, presentation, onOpenPro }: ProUpgradeSheetProps) {
  const openProPending = useRef(false);
  const reduceMotion = useReduceMotion();
  // Two hand-drawn takes per doodle, flipped for the line boil.
  const doodles = useMemo(() => GROUPS.map((group) => drawBoilPair(group.doodle)), []);
  const openPro = () => {
    openProPending.current = true;
    onClose();
  };
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onClosed={() => {
        if (!openProPending.current) return;
        openProPending.current = false;
        onOpenPro();
      }}
      heightPercent={0.88}
      fitContent
      presentation={presentation}
    >
      {/* In the app's own look rather than a stock paywall: the PRO badge
          (no crown), the orange dot as the bullet (no icon chips), thin
          rules between groups instead of boxes. Orange only where it means Pro.
          Hierarchy, one step per level: the dotted title (24) > group
          (18) > benefit (14, dark) > detail (13, gray). "See all" is one
          quiet line, so Unlock Pro is the only loud action. */}
      <View className="px-6 pb-8 pt-10">
        <View className="items-start gap-3">
          <ProBadge />
          <View>
            <AppText variant="sectionTitle" dot>
              {title}
            </AppText>
            <Text className="mt-1 font-inter-regular text-body text-ink-subtle">{body}</Text>
          </View>
        </View>

        {/* Rules only between groups; each group's benefits indented a bit
            under its name. */}
        <View className="mt-7">
          {GROUPS.map((group, i) => (
            <View key={group.label} className={`gap-3 pb-5 ${i > 0 ? "border-t border-ink-emphasis/10 pt-5" : ""}`}>
              <View className="flex-row items-center gap-2.5">
                <BoilingDoodle versions={doodles[i]} size={24} color={colors.accent} strokeWidth={1.8} paused={reduceMotion || !visible} />
                <Text className="font-inter-semibold text-subheading text-ink-emphasis">{group.label}</Text>
              </View>
              <View className="gap-3 pl-3">
                {group.benefits.map(({ title: benefit, detail }) => (
                  <View key={benefit} className="flex-row gap-3">
                    <View className="mt-1.5 h-2 w-2 rounded-full bg-accent" />
                    <View className="flex-1">
                      <Text className="font-inter-semibold text-body text-ink-emphasis">{benefit}</Text>
                      <Text className="font-inter-regular text-small text-ink-subtle">{detail}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        <Pressable
          onPress={openPro}
          accessibilityRole="button"
          accessibilityLabel="Just a few highlights. See all Pro features."
          hitSlop={8}
          className="mt-1 flex-row items-center gap-1 self-start active:opacity-60"
        >
          <Text className="font-inter-regular text-small text-ink-subtle">
            Just a few highlights. <Text className="font-inter-semibold text-ink-emphasis">See all Pro features</Text>
          </Text>
          <ArrowRight color={colors.ink.emphasis} size={14} />
        </Pressable>

        <View className="mt-7">
          <Button label="Unlock Pro" variant="secondary" onPress={openPro} />
        </View>
      </View>
    </BottomSheet>
  );
}
