/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./frontend/app/**/*.{js,jsx,ts,tsx}",
    "./frontend/components/**/*.{js,jsx,ts,tsx}",
    "./frontend/features/**/*.{js,jsx,ts,tsx}",
    "./frontend/core/**/*.{js,jsx,ts,tsx}",
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
        avatar: {
          // Generated-avatar fallback palette only (see components/ui/Avatar.tsx).
          // Not general-purpose brand colors — reach for primary/accent instead.
          navy: "#294E61",
        },
        category: {
          // Category card bg/border pairs + badge-icon colors (Home's
          // Categories section). Not general-purpose brand colors.
          breakfast: "#FEF1E6",
          "breakfast-border": "#FAEAD2",
          // Selected-state border: 10% darker than the base border (see CategoryCard.tsx). Fill stays unchanged.
          "breakfast-border-selected": "#E1D3BD",
          lunch: "#EEEFE2",
          "lunch-border": "#E5EDCA",
          "lunch-border-selected": "#CED5B6",
          dinner: "#FDEFE0",
          "dinner-border": "#FFE2CF",
          "dinner-icon": "#F4A188",
          "dinner-border-selected": "#E6CBBA",
          fastfood: "#FCEBE1",
          "fastfood-border": "#FFE2CF",
          "fastfood-icon": "#DF6969",
          "fastfood-border-selected": "#E6CBBA",
        },
        macro: {
          // MacroBreakdown's per-macro accent colors (features/meals).
          protein: "#006D4D",
          carbs: "#FB923C",
          fats: "#F46767",
        },
        // Liked-heart red (MealCard). Not a general-purpose brand color.
        like: "#EF4444",
        // Button's "tinted" variant fill (e.g. a meal card's "View Details").
        "tinted-bg": "#DFF3E3",
        // Browse's mood-selection card background (features/browse).
        "mood-bg": "#F3F7F3",
        notice: {
          // Amber info/disclaimer banners (e.g. meal detail's price note).
          bg: "#FFFBEB",
          border: "#FDE68A",
          icon: "#F59E0B",
          text: "#92400E",
          // Soft green "reassurance" tone (e.g. Preferences sheet's save note)
          // — same NoticeBanner shape, calmer palette than the amber default.
          "positive-bg": "#F3F7EF",
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
        body: "14px",
        sub: ["10px", { lineHeight: "10px" }],
        // A meal card's description text (12px/20px, 0.5px tracking).
        small: ["13px", { lineHeight: "20px", letterSpacing: "0.5px" }],
      },
    },
  },
  plugins: [],
};
