import { useCallback, useRef } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

// The strip's crossfade. Reduce motion: quicker, not instant.
const FADE_MS = 200;
const FADE_REDUCED_MS = 80;

type StatusBarStripOptions = {
  /** The strip's color over the page's dark top, e.g. a dark backdrop. */
  color: string;
  /** Where (in the scroll content) the dark top ends under the clock: past
   *  it the strip turns white and the clock dark. */
  darkUntil: number;
  /** A white overlay (a page intro) is up: dark clock either way. */
  forceDark?: boolean;
  /** Where (in the scroll content) a textured header's green ends: while it
   *  still fills the status bar, the strip is clear so the header shows
   *  through (a solid strip over its light reads as a hard line), fading in
   *  once the header's edge reaches the bottom of the status bar. */
  clearUntil?: number;
};

// A solid strip behind the status bar for a screen whose page scrolls
// under it (Screen with no top edge, the content padded down by `top`):
// `color` with a light clock and battery over the dark top, crossfading to
// white with a dark clock once the page has scrolled past `darkUntil`.
// Only while the screen is showing (tab screens stay mounted, so a
// <StatusBar> element would stick). Render `strip` after the ScrollView and
// pass it `onScroll`.
export function useStatusBarStrip({ color, darkUntil, forceDark = false, clearUntil }: StatusBarStripOptions) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const overDark = useRef(true);
  const toWhite = useSharedValue(0);
  const clear = useRef(clearUntil != null);
  const shown = useSharedValue(clearUntil != null ? 0 : 1);

  const applyStatusBar = useCallback(() => {
    setStatusBarStyle(overDark.current && !forceDark ? "light" : "dark");
  }, [forceDark]);
  useFocusEffect(
    useCallback(() => {
      applyStatusBar();
      return () => setStatusBarStyle("dark");
    }, [applyStatusBar]),
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (clearUntil != null) {
      const nowClear = e.nativeEvent.contentOffset.y + insets.top < clearUntil;
      if (nowClear !== clear.current) {
        clear.current = nowClear;
        shown.value = withTiming(nowClear ? 0 : 1, { duration: reduceMotion ? FADE_REDUCED_MS : FADE_MS });
      }
    }
    // The clock's line: half way down the status bar.
    const clockLine = e.nativeEvent.contentOffset.y + insets.top / 2;
    const dark = clockLine < darkUntil;
    if (dark === overDark.current) return;
    overDark.current = dark;
    applyStatusBar();
    toWhite.value = withTiming(dark ? 0 : 1, { duration: reduceMotion ? FADE_REDUCED_MS : FADE_MS });
  };

  const stripStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(toWhite.value, [0, 1], [color, colors.white]),
    opacity: shown.value,
  }));
  const strip = (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top }, stripStyle]} />
  );

  return { top: insets.top, onScroll, strip };
}
