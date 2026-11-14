import { type ComponentProps } from "react";
import { StyleSheet, Text as RNText, TextInput as RNTextInput, useWindowDimensions, type TextStyle } from "react-native";

// React Native's Text and TextInput, sized in three fixed AnoUlam levels
// instead of following the phone's text-size setting (Android Font size,
// iOS Text Size / Larger Text) step by step. The phone's setting picks a level:
//
//   phone setting            level     reading   headings (22-24px)   display (30px+)
//   below default             (phone)   follows the phone, shrinking like any app
//   default                   Regular   1x        1x                   1x
//   middle (up to 1.25x)      Bigger    1.15x     1.1x                 1x
//   largest (above 1.25x)     Largest   1.3x      1.15x                1x
//
// Smaller-than-default settings shrink AnoUlam with the phone, as before the
// levels existed. From the default up, the system's own scaling is off
// (allowFontScaling false) and the size comes from the text's size token
// (text-body, text-heading, ...) or its style's fontSize; display sizes (hero
// titles, big prices) never grow. Text with neither inherits its parent's
// (already scaled) size.
// Import these instead of React Native's
// (`import { Text } from "@/frontend/components/ui/Text"`).

type Level = 0 | 1 | 2;
const READING = [1, 1.15, 1.3] as const;
const HEADING = [1, 1.1, 1.15] as const;
const DISPLAY = [1, 1, 1] as const;

/** The AnoUlam text level for the phone's font scale. */
export function textLevel(fontScale: number): Level {
  return fontScale <= 1 ? 0 : fontScale <= 1.25 ? 1 : 2;
}

// The size tokens from tailwind.config.js (keep in step with it): size,
// line height if it sets one, and how far it scales.
type Token = { size: number; lineHeight?: number; scale: readonly number[] };
const TOKENS: Record<string, Token> = {
  hero: { size: 70, lineHeight: 76, scale: DISPLAY },
  subhero: { size: 55, lineHeight: 59, scale: DISPLAY },
  "heading-lg": { size: 30, lineHeight: 36, scale: DISPLAY },
  heading: { size: 24, scale: HEADING },
  "heading-sm": { size: 22, scale: HEADING },
  subheading: { size: 18, scale: READING },
  "body-lg": { size: 16, lineHeight: 24, scale: READING },
  body: { size: 14, scale: READING },
  small: { size: 13, lineHeight: 20, scale: READING },
  sub: { size: 10, lineHeight: 10, scale: READING },
};
const TOKEN_CLASS = /(?:^|\s)text-(hero|subhero|heading-lg|heading-sm|heading|subheading|body-lg|body|small|sub)(?=\s|$)/g;

function scaleFor(size: number) {
  return size >= 28 ? DISPLAY : size >= 21 ? HEADING : READING;
}

/** The style that sizes this text for `level`, or undefined (as designed). */
function levelStyle(level: Level, className: string | undefined, style: ComponentProps<typeof RNText>["style"]): TextStyle | undefined {
  if (level === 0) return undefined;
  const own = StyleSheet.flatten(style);
  // An explicit fontSize in style (a big rolling price, an icon label) wins.
  if (typeof own?.fontSize === "number") {
    const m = scaleFor(own.fontSize)[level];
    return m === 1 ? undefined : { fontSize: own.fontSize * m, ...(typeof own.lineHeight === "number" ? { lineHeight: own.lineHeight * m } : null) };
  }
  if (!className) return undefined;
  let token: Token | undefined;
  for (const match of className.matchAll(TOKEN_CLASS)) token = TOKENS[match[1]]; // the last size class wins, like CSS
  if (!token) return undefined;
  const m = token.scale[level];
  if (m === 1) return undefined;
  return { fontSize: token.size * m, ...(token.lineHeight ? { lineHeight: token.lineHeight * m } : null) };
}

export function Text(props: ComponentProps<typeof RNText> & { className?: string }) {
  const { fontScale } = useWindowDimensions();
  // Below the default: let the phone shrink it, as any app.
  if (fontScale < 1) return <RNText {...props} />;
  const sized = levelStyle(textLevel(fontScale), props.className, props.style);
  return <RNText {...props} allowFontScaling={false} style={sized ? [props.style, sized] : props.style} />;
}

export function TextInput(props: ComponentProps<typeof RNTextInput> & { className?: string }) {
  const { fontScale } = useWindowDimensions();
  if (fontScale < 1) return <RNTextInput {...props} />;
  const sized = levelStyle(textLevel(fontScale), props.className, props.style);
  return <RNTextInput {...props} allowFontScaling={false} style={sized ? [props.style, sized] : props.style} />;
}
