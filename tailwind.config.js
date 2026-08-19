/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./features/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Real brand values (2026-08-19), not placeholders.
        primary: "#286046", // main CTA green
        accent: "#E36B17", // orange accent
        ink: {
          subtle: "#666666", // subtle text
          DEFAULT: "#444444", // normal text
          emphasis: "#2B3437", // text needing emphasis
        },
      },
      fontFamily: {
        // One family, whole app — Inter. Named by weight, not by role
        // (heading/body), since there's only one family now.
        "inter-light": ["Inter_300Light"],
        "inter-regular": ["Inter_400Regular"],
        "inter-medium": ["Inter_500Medium"],
        "inter-semibold": ["Inter_600SemiBold"],
        "inter-bold": ["Inter_700Bold"],
        "inter-extrabold": ["Inter_800ExtraBold"],
      },
      fontSize: {
        // Real type scale (2026-08-19). "sub" was given as "10px / 10px",
        // read as font-size/line-height (tight leading for small text).
        hero: ["70px", { lineHeight: "76px" }],
        subhero: ["55px", { lineHeight: "59px" }],
        heading: "24px",
        subheading: "18px",
        body: "18px",
        sub: ["10px", { lineHeight: "10px" }],
      },
    },
  },
  plugins: [],
};
