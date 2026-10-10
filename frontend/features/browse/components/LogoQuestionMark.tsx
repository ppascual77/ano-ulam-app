import type { RefObject } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { colors } from "@/frontend/constants/theme";

// The AnoUlam fork question mark as the "?" of "What are you craving today",
// with its dot as a separate View: the Browse intro's dot flies in and lands
// there, like the logo's own dot in the intro.gif.

// logo_clean.png is 358 x 512: the fork's body ends at row 389, its dot is
// centered at (122.5, 421.5) with a 61px diameter.
const HEIGHT = 22;
const SCALE = HEIGHT / 512;
const WIDTH = 358 * SCALE;
const BODY_HEIGHT = 389 * SCALE;
const DOT_X = 122.5 * SCALE;
const DOT_Y = 421.5 * SCALE;
// A touch bigger than the logo's own dot, so the landing reads.
const DOT_SIZE = 4.5;

type LogoQuestionMarkProps = {
  /** The dot: where the intro's dot lands (measured, so collapsable={false}). */
  dotRef?: RefObject<View | null>;
  /** false hides the dot until the intro's dot has landed on it. */
  showDot?: boolean;
};

// Inline inside a Text (sits on the text's baseline like a "?" would).
export function LogoQuestionMark({ dotRef, showDot = true }: LogoQuestionMarkProps) {
  return (
    <View style={{ width: WIDTH, height: HEIGHT, marginLeft: 3 }}>
      {/* The body only: the image's own dot is cropped off. */}
      <View style={{ width: WIDTH, height: BODY_HEIGHT, overflow: "hidden" }}>
        <Image source={require("@/assets/icons/logo_clean.png")} style={{ width: WIDTH, height: HEIGHT }} contentFit="contain" />
      </View>
      <View
        ref={dotRef}
        collapsable={false}
        style={{
          position: "absolute",
          left: DOT_X - DOT_SIZE / 2,
          top: DOT_Y - DOT_SIZE / 2,
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: DOT_SIZE / 2,
          backgroundColor: colors.brandGreen.DEFAULT,
          opacity: showDot ? 1 : 0,
        }}
      />
    </View>
  );
}
