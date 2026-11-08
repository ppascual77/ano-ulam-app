import { memo, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { ScrollView as GestureScrollView } from "react-native-gesture-handler";
import Animated, {
  type SharedValue,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
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
const PAGE_TILT_DEG = 8;
// Arrow buttons (h-9 w-9), centered on the card's edges so they sit in the
// screen padding instead of over the card's text.
const ARROW_SIZE = 36;
// Gesture handler's ScrollView, animated: the page scrolls in the same kind
// (PriceWatchScreen), so the two are native scroll views nested the way iOS
// expects.
const AnimatedGestureScrollView = Animated.createAnimatedComponent(GestureScrollView);

// One card, placed by the page position `pos` (scroll x / step: 1.4 means
// 40% of the way from card 1 to card 2). The cards live inside a horizontal
// ScrollView but are drawn on a fixed "stage": translateX adds the scroll
// back (`scrollX`), then slides and tilts them like the showreel, so the
// look is the same as before. Off-page cards are hidden, so nothing peeks in.
function PagedCard({
  i,
  pos,
  scrollX,
  step,
  children,
}: {
  i: number;
  pos: SharedValue<number>;
  scrollX: SharedValue<number>;
  step: number;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const offset = i - pos.value;
    const tilt = Math.max(-1, Math.min(1, offset)) * PAGE_TILT_DEG;
    return {
      opacity: Math.abs(offset) >= 1 ? 0 : 1,
      transform: [{ translateX: scrollX.value + offset * step }, { rotate: `${tilt}deg` }],
    };
  });
  // The shadow sits on a wrapper: each card's own overflow-hidden (for its
  // rounded corners) would clip it on iOS.
  return (
    <Animated.View style={[{ position: "absolute", top: 0, left: 0, bottom: 0 }, style]}>
      <View style={{ flex: 1, borderRadius: 24 }} className="bg-white shadow-sm">
        {children}
      </View>
    </Animated.View>
  );
}

type FreshPicksSectionProps = {
  picks: PriceItem[];
  loading: boolean;
  onSelect: (item: PriceItem) => void;
  /** Price Watch is on screen (focused, past its intro): the shown slide's
   *  prices roll then, and again on each return to the tab. */
  visible: boolean;
};

// Paging is a native horizontal ScrollView snapping one card at a time
// (gesture handler's, like the page's own): iOS sorts a sideways scroll
// inside the vertical page by itself (direction lock), and taps vs. swipes
// on the cards come for free. A custom pan here (two attempts, see
// fix/fresh-picks-swipe) never swiped on the phone: the touch went to the
// card's tap instead. The tilt still comes from the scroll position.
function FreshPicksSectionInner({ picks, loading, onSelect, visible }: FreshPicksSectionProps) {
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
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const pos = useDerivedValue(() => scrollX.value / step);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  // No arrows on the board: they'd cover its trend chips. It's swipe-only,
  // and the dots under it show there's more.
  const onBoard = hasBoard && current === 0;
  const canGoPrev = current > 0 && !onBoard;
  const canGoNext = current < count - 1 && !onBoard;

  const goTo = (next: number) => {
    setIndex(next);
    scrollRef.current?.scrollTo({ x: next * step, animated: true });
  };

  // The page settles: which card is shown (for the dots, arrows and the
  // shown card's own animations).
  const settle = (x: number) => setIndex(Math.max(0, Math.min(count - 1, Math.round(x / step))));

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
            <AnimatedGestureScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={step}
              decelerationRate="fast"
              disableIntervalMomentum
              onScroll={onScroll}
              scrollEventThrottle={16}
              onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.x)}
              onScrollEndDrag={(e) => {
                // A slow drag that lands exactly on a card has no momentum.
                if (Math.abs((e.nativeEvent.velocity?.x ?? 0)) < 0.01) settle(e.nativeEvent.contentOffset.x);
              }}
              // The cards are drawn on the fixed stage (PagedCard), so they
              // can tilt past the edges without being clipped.
              style={{ width: cardWidth, height: CARD_HEIGHT, overflow: "visible" }}
              contentContainerStyle={{ width: cardWidth + (count - 1) * step, height: CARD_HEIGHT }}
            >
              {hasBoard && (
                <PagedCard i={0} pos={pos} scrollX={scrollX} step={step}>
                  <FreshPicksBoard items={boardItems} width={cardWidth} active={visible && current === 0} onSelect={onSelect} />
                </PagedCard>
              )}
              {cardItems.map((item, i) => (
                <PagedCard key={item.id} i={i + firstCard} pos={pos} scrollX={scrollX} step={step}>
                  <FreshPickCard
                    item={item}
                    index={i}
                    width={cardWidth}
                    active={visible && current === i + firstCard}
                    onPress={() => onSelect(item)}
                  />
                </PagedCard>
              ))}
            </AnimatedGestureScrollView>

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

// Re-renders only when its own props change, not whenever the screen does
// (a Price Watch re-render, e.g. on a tab switch, cost ~150-200ms when
// every section re-rendered with it).
export const FreshPicksSection = memo(FreshPicksSectionInner);
