import { Pressable, Text, View } from "react-native";
import Animated, {
  interpolate,
  Extrapolation,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { Search } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

const BAR_HEIGHT = 52;
// How far (px of scroll) the bar takes to slide fully in.
const RAMP = 36;

type BrowseMiniHeaderProps = {
  scrollY: SharedValue<number>;
  /** Where the big header (down to the search pill) ends in the scroll content. */
  headerBottom: number;
  /** The status bar's height: the bar sits right under it. */
  top: number;
  /** Back to the top, where the search pill is. */
  onSearchPress: () => void;
  /** Shown (the screen tracks this from its scroll): touchable only then. */
  visible: boolean;
};

// Where (scroll offset) the bar starts sliding in: as the search pill passes
// under it.
export const miniHeaderStart = (headerBottom: number, top: number) =>
  headerBottom - top - BAR_HEIGHT - RAMP;

// Browse's slim header once the big one has scrolled away: the same green,
// "Browse." and a search button, sliding down from under the status bar as
// the search pill goes past. Not touchable while hidden.
export function BrowseMiniHeader({
  scrollY,
  headerBottom,
  top,
  onSearchPress,
  visible,
}: BrowseMiniHeaderProps) {
  const start = miniHeaderStart(headerBottom, top);
  const style = useAnimatedStyle(() => {
    const k = interpolate(
      scrollY.value,
      [start, start + RAMP],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: k,
      transform: [{ translateY: (k - 1) * BAR_HEIGHT * 0.6 }],
    };
  });

  return (
    // Position and motion on the Animated.View; the look on a plain View
    // inside (NativeWind classes don't reach an Animated.View given an
    // animated style array).
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[
        { position: "absolute", top, left: 0, right: 0, height: BAR_HEIGHT },
        style,
      ]}
    >
      <View className="flex-1 flex-row items-center justify-between bg-home-top px-6">
        <View className="flex-row items-end">
          <Text className="font-inter-extrabold text-heading tracking-display text-white">
            Browse
          </Text>
          <Text className="font-inter-extrabold text-heading text-accent">
            .
          </Text>
        </View>
        <Pressable
          onPress={onSearchPress}
          hitSlop={8}
          accessibilityLabel="Search"
          className="h-9 w-9 items-center justify-center rounded-full bg-white/15 active:bg-white/25"
        >
          <Search color={colors.white} size={17} strokeWidth={2.4} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
