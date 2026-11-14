import { type ComponentProps } from "react";
import { StyleSheet, Text as RNText, TextInput as RNTextInput } from "react-native";

// React Native's Text and TextInput with a ceiling on the phone's text-size
// setting (Android Font size, iOS Text Size / Larger Text), so people who
// enlarge their text get a more readable app without screens breaking
// (a Samsung with large text split "AnoUlam" mid-word on the intro):
// - reading text scales with the setting, up to 1.3x;
// - headings (24px and 22px) up to 1.15x;
// - display sizes (the 30px and bigger titles, big prices) don't scale:
//   they're already large, and they're what breaks a layout.
// Pass maxFontSizeMultiplier to override. Import these instead of React
// Native's (`import { Text } from "@/frontend/components/ui/Text"`).

const READING = 1.3;
const HEADING = 1.15;
const DISPLAY = 1;

// The size tokens from tailwind.config.js, by how far they may scale.
const DISPLAY_CLASS = /(^|\s)text-(hero|subhero|heading-lg)(\s|$)/;
const HEADING_CLASS = /(^|\s)text-(heading|heading-sm)(\s|$)/;

type Styled = { className?: string; style?: ComponentProps<typeof RNText>["style"] };

function capFor({ className, style }: Styled): number {
  // An explicit font size in style (e.g. a big rolling price) wins.
  const fontSize = StyleSheet.flatten(style)?.fontSize;
  if (typeof fontSize === "number") return fontSize >= 28 ? DISPLAY : fontSize >= 21 ? HEADING : READING;
  if (className && DISPLAY_CLASS.test(className)) return DISPLAY;
  if (className && HEADING_CLASS.test(className)) return HEADING;
  return READING;
}

export function Text(props: ComponentProps<typeof RNText> & { className?: string }) {
  return <RNText maxFontSizeMultiplier={capFor(props)} {...props} />;
}

export function TextInput(props: ComponentProps<typeof RNTextInput> & { className?: string }) {
  return <RNTextInput maxFontSizeMultiplier={READING} {...props} />;
}
