// Source of truth for brand values used outside className (StatusBar, icons,
// splash screen, chart libs). Tailwind classes stay in tailwind.config.js —
// keep the hex values below in sync with it when the palette changes.

export const colors = {
  primary: "#286046", // main CTA green
  accent: "#E36B17", // orange accent
  ink: {
    subtle: "#666666",
    normal: "#444444",
    emphasis: "#2B3437",
  },
  white: "#FFFFFF",
} as const;

export const fonts = {
  light: "Inter_300Light",
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
} as const;
