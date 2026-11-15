import { type ReactNode, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Carrot, Check, ChevronDown, Drumstick, Info, Milk, Package, type LucideIcon } from "lucide-react-native";
import { AppText, BottomSheet, RollingText, SegmentedSwitch } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { pantryHas } from "@/frontend/core/pantry/hooks/usePantry";
import type { PantryIngredient } from "@/frontend/core/pantry/types";
import type { GroceryItem } from "../utils/buildGroceryList";
import { GROCERY_SECTIONS, GROCERY_SECTION_LABELS, type GrocerySectionKey } from "../utils/groceryLabels";
import { GroceryRow, formatPeso } from "./GroceryRow";
import { splitGroceryItems } from "./GrocerySection";
import { useStaplesToBuyStore } from "../store/useStaplesToBuyStore";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

const EASE = Easing.out(Easing.cubic);
// A row arriving (a meal switched on, a staple moved to "To buy", an item
// unchecked from "Got it") or leaving (a meal switched off): a short fade
// while the rows around it slide to make room or close the gap.
const MOVE_IN = FadeInDown.duration(280);
const ROW_IN = FadeIn.duration(220);
const ROW_OUT = FadeOut.duration(180);
const MOVE_LAYOUT = LinearTransition.duration(260).easing(EASE);
// Checking an item off: it strikes through and fades in place first, then
// after this long leaves for "Got it" (fading out as the rows below slide up).
const CHECK_SETTLE_MS = 450;
const CHECK_OUT = FadeOut.duration(200);
// An opened fold's rows fade in one after another, this far apart (capped,
// so a long list doesn't trickle).
const STAGGER_MS = 25;
const STAGGER_MAX = 10;

const SECTION_ICONS: Record<GrocerySectionKey, LucideIcon> = {
  produce: Carrot,
  meat: Drumstick,
  packaged: Package,
};

// One list in the sheet: saved meals, or the meal plan.
export type GroceryListTab = {
  key: string;
  label: string;
  items: GroceryItem[];
  total: number;
  isChecked: (item: GroceryItem) => boolean;
  onToggle: (item: GroceryItem) => void;
  /** Shown when the list has no items. */
  emptyText: string;
  /** A second choice inside this tab (the meal plan: one day or the whole
   *  plan), as a small switch under the tabs. */
  scope?: { options: { value: string; label: string }[]; value: string; onChange: (value: string) => void };
  /** Above the list, under the tabs (the saved meals' meal picker). */
  header?: ReactNode;
};

type FullGroceryListSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** After the close animation ends (see BottomSheet's onClosed). */
  onClosed?: () => void;
  /** With more than one, a tab switcher shows under the title. */
  tabs: GroceryListTab[];
  /** Which tab it opens on (defaults to the first). */
  initialTab?: string;
  pantry: PantryIngredient[];
};

// Items already in the pantry get checked once when the sheet opens (per
// item, per app session), so unchecking one sticks until the next launch.
const autoCheckedHave = new Set<string>();

const COUNT_UP_MS = 600;

// The total ticks up from 0 each time the sheet opens (or the tab changes),
// like the teaser's grocery list. Other changes (a meal switched on, a
// staple moved to "To buy") tick from the current value to the new one.
function useCountUp(target: number, resetKey: string, run: boolean) {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);
  const lastReset = useRef<string | null>(null);
  useEffect(() => {
    if (!run) {
      lastReset.current = null;
      return;
    }
    const from = lastReset.current === resetKey ? valueRef.current : 0;
    lastReset.current = resetKey;
    setValue(from);
    let frame = 0;
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / COUNT_UP_MS);
      valueRef.current = from + (target - from) * (1 - Math.pow(1 - p, 3)); // ease-out cubic
      setValue(valueRef.current);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, resetKey, run]);
  return value;
}

// ---- summary ------------------------------------------------------------------

type SummaryProps = {
  total: number;
  left: number;
  picked: number;
  count: number;
  /** Whole packs leave some over: the note about why the total is higher. */
  leftover: boolean;
};

// The three answers up top: what it costs, how many are left, how far along.
// The two small print notes sit behind the ⓘ by the total.
function SummaryCard({ total, left, picked, count, leftover }: SummaryProps) {
  const reduceMotion = useReduceMotion();
  const [infoOpen, setInfoOpen] = useState(false);
  const share = count > 0 ? picked / count : 0;
  const fill = useSharedValue(share);
  useEffect(() => {
    fill.value = withTiming(share, { duration: reduceMotion ? 0 : 420, easing: EASE });
  }, [share, reduceMotion]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const allDone = count > 0 && left === 0;

  return (
    <Animated.View layout={reduceMotion ? undefined : MOVE_LAYOUT} className="mt-4 rounded-3xl bg-mood-bg px-4 py-4">
      <View className="flex-row items-end justify-between gap-3">
        <View>
          <Pressable
            onPress={() => setInfoOpen((open) => !open)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="About this estimate"
            accessibilityState={{ expanded: infoOpen }}
            className="flex-row items-center gap-1.5 active:opacity-60"
          >
            <Text className="font-inter-medium text-small text-ink-subtle">Estimated total</Text>
            <Info color={colors.ink.subtle} size={13} />
          </Pressable>
          <Text numberOfLines={1} adjustsFontSizeToFit className="font-inter-extrabold text-heading-lg tracking-display text-primary">
            ~₱{formatPeso(total, 0)}
          </Text>
        </View>
        <View className="items-end">
          <RollingText value={left} rank={left} className="font-inter-extrabold text-heading text-ink-emphasis" />
          <Text className="font-inter-medium text-small text-ink-subtle">left to buy</Text>
        </View>
      </View>

      {/* Plain style on the Animated.View, className on the inner View:
          NativeWind can knock out Reanimated's animated values. */}
      <View className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-primary/10">
        <Animated.View style={[{ height: "100%" }, fillStyle]}>
          <View className="flex-1 rounded-full bg-primary" />
        </Animated.View>
      </View>
      <View className="mt-2 flex-row items-center gap-1">
        {allDone && <Check color={colors.primary} size={14} strokeWidth={3} />}
        <Text className={`font-inter-medium text-small ${allDone ? "text-primary" : "text-ink-subtle"}`}>
          {allDone ? "All picked up" : `${picked} of ${count} picked up`}
        </Text>
      </View>

      {infoOpen && (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(200)}
          exiting={reduceMotion ? undefined : FadeOut.duration(150)}
          className="mt-3 gap-1.5 border-t border-ink-emphasis/10 pt-3"
        >
          {leftover && (
            <Text className="font-inter-regular text-small text-ink-subtle">
              Some items only come in whole packs, so this is more than your meals use. The rest stays in your pantry.
            </Text>
          )}
          <Text className="font-inter-regular text-small text-ink-subtle">Prices are a guide only and may vary by store, market and day.</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ---- folds --------------------------------------------------------------------

type FoldProps = {
  Icon: LucideIcon;
  /** Icon tile: green for "Got it", neutral for staples. */
  tone: "green" | "neutral";
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

// A section folded into one line (pantry staples, "Got it"): opens in place,
// the chevron turning as it goes.
function Fold({ Icon, tone, title, subtitle, open, onToggle, children }: FoldProps) {
  const reduceMotion = useReduceMotion();
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.value = withTiming(open ? 1 : 0, { duration: reduceMotion ? 0 : 220, easing: EASE });
  }, [open, reduceMotion]);
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));

  return (
    <Animated.View layout={reduceMotion ? undefined : MOVE_LAYOUT} className="mt-3 overflow-hidden rounded-2xl border border-ink-emphasis/10">
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onToggle();
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70"
      >
        <View className={`h-8 w-8 items-center justify-center rounded-xl ${tone === "green" ? "bg-tinted-bg" : "bg-web-divider"}`}>
          <Icon color={tone === "green" ? colors.primary : colors.ink.subtle} size={16} strokeWidth={tone === "green" ? 2.5 : 2} />
        </View>
        <View className="flex-1">
          <Text className="font-inter-bold text-body-lg text-ink-emphasis">{title}</Text>
          <Text className="font-inter-regular text-small text-ink-subtle">{subtitle}</Text>
        </View>
        <Animated.View style={chevronStyle}>
          <ChevronDown color={colors.ink.subtle} size={18} />
        </Animated.View>
      </Pressable>
      {open && <View className="border-t border-ink-emphasis/5 px-2 pb-2 pt-1">{children}</View>}
    </Animated.View>
  );
}

function FoldLabel({ children }: { children: ReactNode }) {
  return <Text className="px-2 pb-0.5 pt-3 font-inter-bold text-sub uppercase tracking-wide text-ink-subtle">{children}</Text>;
}

// ---- the sheet ----------------------------------------------------------------

export function FullGroceryListSheet({ visible, onClose, onClosed, tabs, initialTab, pantry }: FullGroceryListSheetProps) {
  const [activeKey, setActiveKey] = useState(initialTab ?? tabs[0]?.key);
  useEffect(() => {
    if (visible) setActiveKey(initialTab ?? tabs[0]?.key);
    // Reset to the caller's tab on each open.
  }, [visible]);
  const moveStaple = useStaplesToBuyStore((s) => s.toggle);
  const reduceMotion = useReduceMotion();
  // The row just moved drops in from above; other arrivals just fade.
  const [justMoved, setJustMoved] = useState<string | null>(null);
  const handleMove = (id: string) => {
    Haptics.selectionAsync();
    setJustMoved(id);
    moveStaple(id);
  };
  // Just checked: still shown in place (struck through) until it settles.
  const [settling, setSettling] = useState<Set<string>>(new Set());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // Both folds start closed: the list is what's left to buy.
  const [staplesOpen, setStaplesOpen] = useState(false);
  const [gotItOpen, setGotItOpen] = useState(false);
  const tab = tabs.find((t) => t.key === activeKey) ?? tabs[0];
  // What's on screen: the tab, and its scope when it has one (keys, the
  // total's count-up and the pantry auto-check follow it).
  const viewKey = tab?.scope ? `${tab.key}:${tab.scope.value}` : (tab?.key ?? "");
  // "To buy": main ingredients and any staples moved there.
  const counted = (tab?.items ?? []).filter((item) => item.category === "main");
  const total = counted.reduce((sum, item) => sum + item.price, 0);
  // What the meals use of it. Whole packs cost more than what a recipe
  // uses, and the gap is what's left over in the pantry, which explains why
  // this total is higher than the meals' own prices.
  const used = counted.reduce((sum, item) => sum + item.usedPrice, 0);
  const leftover = Math.round(total) - Math.round(used) >= 1;
  const shownTotal = useCountUp(total, viewKey, visible);
  const picked = tab ? counted.filter(tab.isChecked).length : 0;
  const left = counted.length - picked;

  useEffect(() => {
    if (!visible || !tab) return;
    for (const item of tab.items) {
      const key = `${viewKey}:${item.id}`;
      if (autoCheckedHave.has(key) || !pantryHas(pantry, item.canonicalName)) continue;
      autoCheckedHave.add(key);
      if (!tab.isChecked(item)) tab.onToggle(item);
    }
    // Runs when the sheet opens, the tab changes, or the list/pantry loads.
  }, [visible, viewKey, tab?.items, pantry]);

  // The last item checked off: a success haptic (only on that tap, not when
  // a list opens already done).
  const lastLeft = useRef<{ key: string; left: number } | null>(null);
  useEffect(() => {
    const prev = lastLeft.current;
    lastLeft.current = { key: viewKey, left };
    if (visible && prev?.key === viewKey && prev.left > 0 && left === 0 && counted.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [left, viewKey, visible]);

  if (!tab) return null;
  const { items, isChecked, onToggle } = tab;
  const handleToggle = (item: GroceryItem) => {
    Haptics.selectionAsync();
    if (isChecked(item)) {
      // Unchecked (from "Got it"): straight back into the list.
      setJustMoved(item.id);
    } else {
      setSettling((prev) => new Set(prev).add(item.id));
      timers.current.push(
        setTimeout(() => {
          setSettling((prev) => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        }, CHECK_SETTLE_MS),
      );
    }
    onToggle(item);
  };
  const split = splitGroceryItems(items);
  const mains = split.mains;
  const staples = split.staples;
  // Still to pick up (plus anything checked a moment ago, until it settles),
  // grouped by store section; and what's been checked off.
  const toBuy = mains.filter((item) => !isChecked(item) || settling.has(item.id));
  const gotIt = mains.filter((item) => isChecked(item) && !settling.has(item.id));
  const sections = GROCERY_SECTIONS.map((key) => ({ key, rows: toBuy.filter((item) => item.section === key) })).filter(
    (section) => section.rows.length > 0,
  );
  // Staples: the ones to check you still have, then the ones the pantry
  // says are at home.
  const staplesToCheck = staples.filter((item) => !pantryHas(pantry, item.canonicalName));
  const staplesAtHome = staples.filter((item) => pantryHas(pantry, item.canonicalName));

  // Keyed per tab too, so switching tabs remounts rows instead of sliding
  // ones the two lists share. `stagger`: the row's place in an opened fold.
  const renderRows = (rows: GroceryItem[], stagger = false) =>
    rows.map((item, index) => (
      <Animated.View
        key={`${viewKey}:${item.id}`}
        entering={
          reduceMotion
            ? undefined
            : item.id === justMoved
              ? MOVE_IN
              : stagger
                ? FadeIn.duration(200).delay(Math.min(index, STAGGER_MAX) * STAGGER_MS)
                : ROW_IN
        }
        // Set while it settles, so it's in place when the row leaves.
        exiting={reduceMotion ? undefined : settling.has(item.id) ? CHECK_OUT : ROW_OUT}
        layout={reduceMotion ? undefined : MOVE_LAYOUT}
      >
        <GroceryRow
          item={item}
          checked={isChecked(item)}
          onToggle={() => handleToggle(item)}
          wrap
          have={pantryHas(pantry, item.canonicalName)}
          onMove={item.category === "pantry" || item.movedFromStaples ? () => handleMove(item.id) : undefined}
        />
      </Animated.View>
    ));

  return (
    <BottomSheet visible={visible} onClose={onClose} onClosed={onClosed}>
      <ScrollView contentContainerClassName="px-6 pb-10 pt-10" showsVerticalScrollIndicator={false}>
        <AppText variant="sectionTitle" dot>Grocery list</AppText>

        {counted.length > 0 && <SummaryCard total={shownTotal} left={left} picked={picked} count={counted.length} leftover={leftover} />}

        {tabs.length > 1 && (
          <View className="mt-4 items-start">
            <SegmentedSwitch
              size="md"
              options={tabs.map((t) => ({ value: t.key, label: t.label }))}
              value={tab.key}
              onChange={setActiveKey}
            />
          </View>
        )}

        {tab.scope && (
          <Animated.View key={`scope:${tab.key}`} entering={reduceMotion ? undefined : FadeInDown.duration(220)}>
            <View className="mt-3 flex-row items-center gap-3">
              <Text className="font-inter-medium text-small text-ink-subtle">Shop for</Text>
              <SegmentedSwitch options={tab.scope.options} value={tab.scope.value} onChange={tab.scope.onChange} />
            </View>
          </Animated.View>
        )}

        {tab.header}

        {/* Rows already there when a list first shows don't fade in; rows
            that arrive later (a meal switched on) do. Keyed by the view, so
            a tab switch starts over. */}
        <LayoutAnimationConfig key={viewKey} skipEntering skipExiting>
          {items.length === 0 && (
            <Text className="py-8 text-center font-inter-regular text-body text-web-ink-muted">{tab.emptyText}</Text>
          )}

          {/* What to buy, by market section (the order you'd walk it). */}
          {sections.map((section) => {
            const Icon = SECTION_ICONS[section.key];
            return (
              <Animated.View key={`${viewKey}:${section.key}`} layout={reduceMotion ? undefined : MOVE_LAYOUT} className="mt-6">
                <View className="flex-row items-center gap-2.5 px-2 pb-1">
                  <View className="h-7 w-7 items-center justify-center rounded-full bg-tinted-bg">
                    <Icon color={colors.primary} size={15} strokeWidth={2} />
                  </View>
                  <Text className="font-inter-bold text-body-lg text-ink-emphasis">{GROCERY_SECTION_LABELS[section.key]}</Text>
                  <Text className="font-inter-semibold text-body text-ink-placeholder">{section.rows.length}</Text>
                </View>
                {renderRows(section.rows)}
              </Animated.View>
            );
          })}

          {(staples.length > 0 || gotIt.length > 0) && <View className="h-3" />}

          {staples.length > 0 && (
            <Fold
              Icon={Milk}
              tone="neutral"
              title="Pantry staples"
              subtitle={[
                `${staples.length} item${staples.length === 1 ? "" : "s"}`,
                staplesAtHome.length > 0 ? `${staplesAtHome.length} at home` : null,
                staplesToCheck.length > 0 ? `${staplesToCheck.length} to check` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              open={staplesOpen}
              onToggle={() => setStaplesOpen((open) => !open)}
            >
              {staplesToCheck.length > 0 && (
                <>
                  <FoldLabel>Check you have · {staplesToCheck.length}</FoldLabel>
                  {renderRows(staplesToCheck, true)}
                </>
              )}
              {staplesAtHome.length > 0 && (
                <>
                  <FoldLabel>At home · {staplesAtHome.length}</FoldLabel>
                  {renderRows(staplesAtHome, true)}
                </>
              )}
            </Fold>
          )}

          {/* Checked off, folded away: the list above keeps getting shorter
              as you shop. */}
          {gotIt.length > 0 && (
            <Fold
              Icon={Check}
              tone="green"
              title="Got it"
              subtitle={`${gotIt.length} picked up`}
              open={gotItOpen}
              onToggle={() => setGotItOpen((open) => !open)}
            >
              {renderRows(gotIt, true)}
            </Fold>
          )}
        </LayoutAnimationConfig>
      </ScrollView>
    </BottomSheet>
  );
}
