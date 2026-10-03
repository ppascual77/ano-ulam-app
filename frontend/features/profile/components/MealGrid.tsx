import { ReactNode, useState } from "react";
import { View } from "react-native";
import Animated, { LinearTransition, withTiming } from "react-native-reanimated";

const GAP = 8;

// A card leaving the grid (unsave / delete): fade out and shrink a little
// over 300ms, while the rest reflow into its place.
function cardExit() {
  "worklet";
  return {
    initialValues: { opacity: 1, transform: [{ scale: 1 }] },
    animations: {
      opacity: withTiming(0, { duration: 300 }),
      transform: [{ scale: withTiming(0.93, { duration: 300 }) }],
    },
  };
}

type MealGridProps<T> = {
  items: T[];
  keyOf: (item: T) => string;
  /** Gets the column width to size the card with. */
  renderItem: (item: T, width: number) => ReactNode;
};

// Two equal columns that fill the container. Removing an item from `items`
// plays the exit animation.
export function MealGrid<T>({ items, keyOf, renderItem }: MealGridProps<T>) {
  const [width, setWidth] = useState(0);
  const columnWidth = Math.floor((width - GAP) / 2);

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      className="flex-row flex-wrap"
      style={{ gap: GAP }}
    >
      {width > 0 &&
        items.map((item) => (
          <Animated.View key={keyOf(item)} layout={LinearTransition.duration(300)} exiting={cardExit} style={{ width: columnWidth }}>
            {renderItem(item, columnWidth)}
          </Animated.View>
        ))}
    </View>
  );
}
