import { useEffect, useLayoutEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { AppText } from "@/frontend/components/ui";

type Tagline = {
  before?: string;
  dish: string;
  after?: string;
};

// Mock copy only — no real recommendation data behind this yet.
const TAGLINES: Tagline[] = [
  { dish: "Adobo", after: " seems good today" },
  { dish: "Sinigang", after: " would hit the spot right now" },
  { before: "Craving some ", dish: "Sisig", after: "?" },
  { dish: "Lechon Kawali", after: " is calling your name" },
  { before: "How about ", dish: "Pancit Canton", after: "?" },
  { dish: "Tinola", after: " sounds comforting today" },
  { dish: "Kare-Kare", after: " could hit the spot" },
  { before: "Feeling some ", dish: "Bicol Express", after: "?" },
  { dish: "Chicken Inasal", after: " is trending nearby" },
  { before: "Maybe try ", dish: "Laing", after: " today" },
];

const ROTATE_INTERVAL_MS = 2500;
const ROLL_DURATION_MS = 500;
const ITEM_HEIGHT = 24;

function TaglineRow({ before, dish, after }: Tagline) {
  return (
    <View style={{ height: ITEM_HEIGHT }} className="justify-center">
      <AppText variant="body">
        {before}
        <Text className="font-inter-semibold text-accent">{dish}</Text>
        {after}
      </AppText>
    </View>
  );
}

// Cycles through mock dish suggestions like a slot machine reel. The
// current and next tagline render as one continuous strip that scrolls
// upward, so the next tag immediately follows the one leaving instead of
// animating in as a separate, disconnected element.
//
// Reset-and-advance runs from a plain setTimeout on the JS thread (not a
// withTiming/runOnJS completion callback) — passing the index updater
// closure through runOnJS's UI↔JS bridge as an argument isn't reliably
// serializable, and would silently fail to reset translateY on some ticks,
// letting it drift further negative each cycle until the text scrolled
// permanently out of the clipped container.
export function CravingTagline() {
  const [index, setIndex] = useState(0);
  const translateY = useSharedValue(0);

  // Snapping translateY back to 0 has to land in the same commit as the
  // re-render that updates which taglines the two rows show — otherwise the
  // reset can visually land a frame before the new content does, reading as
  // a flicker (position snaps back while the old pair is still showing).
  // useLayoutEffect (not useEffect) ties the reset to that same commit.
  useLayoutEffect(() => {
    translateY.value = 0;
  }, [index, translateY]);

  useEffect(() => {
    let advanceTimeout: ReturnType<typeof setTimeout>;

    const intervalId = setInterval(() => {
      translateY.value = withTiming(-ITEM_HEIGHT, { duration: ROLL_DURATION_MS });
      advanceTimeout = setTimeout(() => {
        setIndex((i) => (i + 1) % TAGLINES.length);
      }, ROLL_DURATION_MS);
    }, ROTATE_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      clearTimeout(advanceTimeout);
    };
  }, [translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const nextIndex = (index + 1) % TAGLINES.length;

  return (
    <View style={{ height: ITEM_HEIGHT, overflow: "hidden" }}>
      <Animated.View style={animatedStyle}>
        <TaglineRow {...TAGLINES[index]} />
        <TaglineRow {...TAGLINES[nextIndex]} />
      </Animated.View>
    </View>
  );
}
