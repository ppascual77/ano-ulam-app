import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

// Split-flap price for the fresh picks slides: each digit rolls from last
// week's price to today's whenever its slide becomes the active one.

// "md": the board's rows. "lg": a pick card's headline price.
const SIZES = {
  md: { w: 20, h: 30, digit: "text-heading", symbol: "text-body" },
  lg: { w: 26, h: 40, digit: "text-heading-lg", symbol: "text-subheading" },
} as const;
// Index 0 is blank (a digit that didn't exist last week rolls in from
// nothing), then 0-9 twice, so every tile spins at least one full lap.
// Each character is its own Text, exactly a tile tall. (One multi-line Text
// was lighter, but its lines weren't reliably a tile tall each, with the
// phone's text size turned up, or Android's first-line spacing, and the
// error added up over ~20 lines, so tiles stopped on the wrong, cut-off
// digit.)
const ROLL_CHARS = [" ", ..."0123456789", ..."0123456789"];
const ROLL_MS = 900;
// Each digit starts a touch after the one to its left.
const TILE_DELAY_MS = 60;
const ROLL_EASING = Easing.inOut(Easing.cubic);
// Back to last week's digits once the slide has paged away (off screen), so
// the next visit rolls again. Longer than the page slide itself.
const RESET_DELAY_MS = 450;

type Size = keyof typeof SIZES;

function RollingTile({ from, to, active, delay, size }: { from: string; to: string; active: boolean; delay: number; size: Size }) {
  const { w, h, digit } = SIZES[size];
  const start = from === " " ? 0 : 1 + Number(from);
  const end = to === " " ? 0 : 11 + Number(to);
  const y = useSharedValue(-start * h);

  useEffect(() => {
    if (active) {
      y.value = -start * h;
      y.value = withDelay(delay, withTiming(-end * h, { duration: ROLL_MS, easing: ROLL_EASING }));
    } else {
      y.value = withDelay(RESET_DELAY_MS, withTiming(-start * h, { duration: 0 }));
    }
  }, [active, y, start, end, delay, h]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <View className="overflow-hidden rounded-md bg-black/25" style={{ width: w, height: h }}>
      <Animated.View style={style}>
        {/* Only up to the furthest stop: nothing below it is ever shown. */}
        {ROLL_CHARS.slice(0, Math.max(start, end) + 1).map((char, i) => (
          <Text
            key={i}
            // Fixed-size tiles: the phone's text size would outgrow them.
            allowFontScaling={false}
            numberOfLines={1}
            style={{ height: h, lineHeight: h, includeFontPadding: false, textAlignVertical: "center" }}
            className={`text-center font-inter-extrabold text-white ${digit}`}
          >
            {char}
          </Text>
        ))}
      </Animated.View>
      {/* The flap's split line. */}
      <View className="absolute left-0 right-0 h-px bg-black/40" style={{ top: h / 2 }} />
    </View>
  );
}

// Last week's and today's prices as aligned characters. Both get cents if
// either has them; last week's is right-aligned to today's length.
function priceChars(weekAgo: number, latest: number) {
  const cents = !Number.isInteger(weekAgo) || !Number.isInteger(latest);
  const now = cents ? latest.toFixed(2) : String(latest);
  const was = (cents ? weekAgo.toFixed(2) : String(weekAgo)).padStart(now.length, " ").slice(-now.length);
  return [...now].map((to, i) => ({ to, from: was[i] }));
}

type RollingPriceProps = {
  /** Last week's price; the tiles start here. */
  from: number;
  /** Today's price; the tiles land here. */
  to: number;
  /** Rolls when this turns true; resets (off screen) when it turns false. */
  active: boolean;
  /** Before the first digit starts, in ms. */
  delay?: number;
  size?: Size;
};

export function RollingPrice({ from, to, active, delay = 0, size = "md" }: RollingPriceProps) {
  const { symbol } = SIZES[size];
  let digit = 0;
  return (
    <View className="flex-row items-center gap-0.5" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Text className={`mr-0.5 font-inter-extrabold text-white/50 ${symbol}`}>₱</Text>
      {priceChars(from, to).map(({ from: f, to: t }, i) =>
        t === "." ? (
          <Text key={i} className={`font-inter-extrabold text-white/70 ${symbol}`}>
            .
          </Text>
        ) : (
          <RollingTile
            key={i}
            from={f === "." ? " " : f}
            to={t}
            active={active}
            delay={delay + digit++ * TILE_DELAY_MS}
            size={size}
          />
        ),
      )}
    </View>
  );
}
