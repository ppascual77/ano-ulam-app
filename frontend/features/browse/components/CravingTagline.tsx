import { useEffect, useRef } from "react";
import { View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
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

function TaglineRow({ before, dish, after, light }: Tagline & { light: boolean }) {
  return (
    <View style={{ height: ITEM_HEIGHT }} className="justify-center">
      <AppText variant="body" className={light ? "text-white/90" : ""}>
        {before}
        <Text className="font-inter-semibold text-accent">{dish}</Text>
        {after}
      </AppText>
    </View>
  );
}

// Cycles through mock dish suggestions like a slot machine reel: every
// tagline sits in one fixed strip (with the first repeated at the end) that
// rolls up a line at a time. On reaching that repeat it snaps back to the
// top, which can't be seen since the two rows match. Nothing re-renders as
// it rolls: the old version swapped which two taglines showed and snapped
// the strip back in the same frame, and when the JS and UI threads landed
// those a frame apart (scrolling, loading results) it flickered.
// `light`: white text, on Browse's dark green header.
export function CravingTagline({ light = false }: { light?: boolean }) {
  const translateY = useSharedValue(0);
  const step = useRef(0);

  useEffect(() => {
    const count = TAGLINES.length;
    const intervalId = setInterval(() => {
      step.current += 1;
      const target = step.current;
      const atRepeat = target === count;
      if (atRepeat) step.current = 0;
      translateY.value = withTiming(-target * ITEM_HEIGHT, { duration: ROLL_DURATION_MS }, (finished) => {
        // On the repeat of the first line: back to the real first line,
        // invisibly (same text), all on the UI thread.
        if (finished && atRepeat) translateY.value = 0;
      });
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={{ height: ITEM_HEIGHT, overflow: "hidden" }}>
      <Animated.View style={animatedStyle}>
        {[...TAGLINES, TAGLINES[0]].map((tagline, i) => (
          <TaglineRow key={i} {...tagline} light={light} />
        ))}
      </Animated.View>
    </View>
  );
}
