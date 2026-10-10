import { useEffect, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { AppText, CarouselIndicator } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { PriceItem } from "@/frontend/core/prices/utils/prices";
import { FRESH_PICK_CARD_HEIGHT, FreshPickCard } from "./FreshPickCard";
import { BOARD_ROWS, FreshPicksBoard } from "./FreshPicksBoard";

// Card slides after the board: picks #4 to #7.
const PICK_CARDS = 4;
// How many picks the section shows in all (pass to pickFreshPicks).
export const FRESH_PICKS_COUNT = BOARD_ROWS + PICK_CARDS;

// Screen's own px-7 horizontal padding (28px each side).
const SCREEN_PADDING = 56;
const CARD_HEIGHT = FRESH_PICK_CARD_HEIGHT;
// Space between neighboring cards while they slide: wide enough that a
// neighbor never peeks in past the screen edge.
const CARD_GAP = 40;
// Paging: cards slide over with a slight tilt, like the showreel.
const PAGE_MS = 380;
const PAGE_TILT_DEG = 8;
const PAGE_EASING = Easing.inOut(Easing.cubic);
// Arrow buttons (h-9 w-9), centered on the card's edges so they sit in the
// screen padding instead of over the card's text.
const ARROW_SIZE = 36;
// A swipe pages when it's dragged this share of a card, or flicked.
const SWIPE_DISTANCE = 0.2;
const SWIPE_VELOCITY = 500;
// Dragging past the first/last card moves at this fraction (rubber band).
const EDGE_RESISTANCE = 0.3;

// One card, placed by the shared page position: `pos` 1.4 means 40% of the
// way from card 1 to card 2. Off-page cards are hidden, so nothing peeks in.
function PagedCard({ i, pos, step, children }: { i: number; pos: SharedValue<number>; step: number; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => {
    const offset = i - pos.value;
    const tilt = Math.max(-1, Math.min(1, offset)) * PAGE_TILT_DEG;
    return {
      opacity: Math.abs(offset) >= 1 ? 0 : 1,
      transform: [{ translateX: offset * step }, { rotate: `${tilt}deg` }],
    };
  });
  return <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}

type FreshPicksSectionProps = {
  picks: PriceItem[];
  loading: boolean;
  onSelect: (item: PriceItem) => void;
};

// Swipe or arrow-button paging. Not a horizontal ScrollView: nested in the
// page's vertical one it blocked both scroll directions for this whole
// section (a pan responder conflict). The pan below only takes over once a
// drag is clearly horizontal, so vertical scrolling still starts on the card.
export function FreshPicksSection({ picks, loading, onSelect }: FreshPicksSectionProps) {
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = windowWidth - SCREEN_PADDING;
  const step = cardWidth + CARD_GAP;
  const [index, setIndex] = useState(0);
  // Page 0 is the market board with the top picks; the rest each get a card.
  // Every pick has a week-ago price (its % change needs one) to roll from.
  const boardItems = picks.slice(0, BOARD_ROWS);
  const cardItems = picks.slice(BOARD_ROWS, BOARD_ROWS + PICK_CARDS);
  const hasBoard = boardItems.length > 0;
  const firstCard = hasBoard ? 1 : 0;
  const count = cardItems.length + firstCard;
  const current = Math.min(index, Math.max(count - 1, 0));
  const pos = useSharedValue(0);
  const dragStart = useSharedValue(0);

  // Keep the cards on the shown page if the list shrinks under them.
  useEffect(() => {
    pos.value = current;
  }, [count]);

  // No arrows on the board: they'd cover its trend chips. It's swipe-only,
  // and the dots under it show there's more.
  const onBoard = hasBoard && current === 0;
  const canGoPrev = current > 0 && !onBoard;
  const canGoNext = current < count - 1 && !onBoard;

  const goTo = (next: number) => {
    setIndex(next);
    pos.value = withTiming(next, { duration: PAGE_MS, easing: PAGE_EASING });
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onStart(() => {
      dragStart.value = pos.value;
    })
    .onUpdate((e) => {
      const max = count - 1;
      let p = dragStart.value - e.translationX / step;
      if (p < 0) p *= EDGE_RESISTANCE;
      else if (p > max) p = max + (p - max) * EDGE_RESISTANCE;
      pos.value = p;
    })
    .onEnd((e) => {
      const from = Math.round(dragStart.value);
      const moved = pos.value - from;
      const flick = -e.velocityX / step;
      let target = from;
      if (moved > SWIPE_DISTANCE || flick > SWIPE_VELOCITY / step) target = from + 1;
      else if (moved < -SWIPE_DISTANCE || flick < -SWIPE_VELOCITY / step) target = from - 1;
      target = Math.max(0, Math.min(count - 1, target));
      pos.value = withTiming(target, { duration: PAGE_MS, easing: PAGE_EASING });
      scheduleOnRN(setIndex, target);
    });

  return (
    <View className="gap-3">
      <View>
        <AppText variant="sectionTitle" dot>
          This week&apos;s fresh picks
        </AppText>
        <AppText variant="caption">Biggest price drops this week</AppText>
      </View>

      {loading ? (
        <View style={{ height: CARD_HEIGHT, borderRadius: 24 }} className="bg-ink-emphasis/10" />
      ) : count === 0 ? (
        <AppText variant="caption">
          No price changes yet. They need a saved DA price from a week before the latest one (Admin → DA Daily
          Prices → Import last 7 days).
        </AppText>
      ) : (
        <>
          <View className="items-center">
            <GestureDetector gesture={pan}>
              <View style={{ width: cardWidth, height: CARD_HEIGHT }}>
                {hasBoard && (
                  <PagedCard i={0} pos={pos} step={step}>
                    <FreshPicksBoard items={boardItems} width={cardWidth} active={current === 0} onSelect={onSelect} />
                  </PagedCard>
                )}
                {cardItems.map((item, i) => (
                  <PagedCard key={item.id} i={i + firstCard} pos={pos} step={step}>
                    <FreshPickCard
                      item={item}
                      index={i}
                      width={cardWidth}
                      active={current === i + firstCard}
                      onPress={() => onSelect(item)}
                    />
                  </PagedCard>
                ))}
              </View>
            </GestureDetector>

            {canGoPrev && (
              <Pressable
                onPress={() => goTo(current - 1)}
                style={{ top: CARD_HEIGHT / 2 - ARROW_SIZE / 2, left: -ARROW_SIZE / 2 }}
                className="absolute h-9 w-9 items-center justify-center rounded-full border border-ink-emphasis/10 bg-white shadow-sm"
              >
                <ChevronLeft color={colors.primary} size={20} />
              </Pressable>
            )}
            {canGoNext && (
              <Pressable
                onPress={() => goTo(current + 1)}
                style={{ top: CARD_HEIGHT / 2 - ARROW_SIZE / 2, right: -ARROW_SIZE / 2 }}
                className="absolute h-9 w-9 items-center justify-center rounded-full border border-ink-emphasis/10 bg-white shadow-sm"
              >
                <ChevronRight color={colors.primary} size={20} />
              </Pressable>
            )}
          </View>

          {count > 1 && (
            <View className="items-center">
              <CarouselIndicator variant="hop" total={count} activeIndex={current} />
            </View>
          )}
        </>
      )}
    </View>
  );
}
