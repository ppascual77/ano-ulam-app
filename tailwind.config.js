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
        // Web app (ano-ulam-reference) values, added 2026-10-03 for the
        // Discover port so it matches the web exactly. Discover-scoped for
        // now — elsewhere, reach for primary/accent/ink instead.
        "brand-green": { DEFAULT: "#006D4D", dark: "#18402F" },
        "brand-orange": "#F88927",
        verified: "#1D9BF0", // verified-poster badge
        "web-ink": { DEFAULT: "#1F2937", soft: "#374151", body: "#4B5563", muted: "#9CA3AF", faint: "#D1D5DB" },
        "web-divider": "#F3F4F6",
        // Profile port: info blue (updated-meal / servings confirms, catalog
        // "updated" strip) and its soft tile background.
        info: { DEFAULT: "#3B82F6", soft: "#EFF6FF" },
        ink: {
          subtle: "#666666", // subtle text
          DEFAULT: "#444444", // normal text
          emphasis: "#2B3437", // text needing emphasis
          // Input placeholders: clearly lighter than typed text (ink.emphasis)
          // so an empty field never reads as filled. Added 2026-10-03.
          placeholder: "#9CA3AF",
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
        // Price change direction (Price Watch rows, chips, change lines).
        // Cheaper is good, so green; never stock-ticker colors.
        trend: { down: "#16A34A", up: "#EF4444", flat: "#EAB308" },
        // Liked-heart red (MealCard). Not a general-purpose brand color.
        // soft: destructive icon tile behind a red icon (Delete Recipe confirm).
        like: { DEFAULT: "#EF4444", soft: "#FEE2E2" },
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
        tag: {
          // RandomMealPuller's "Surprise me" paper-tag background — a
          // deliberately "dirty"/aged off-white, not general-purpose.
          bg: "#F2EDE1",
        },
        // IngredientDetailPanel's "USDA FoodData Central" attribution badge
        // — a plain informational blue, not a general-purpose brand color.
        usda: "#2563EB",
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
        // Single scoped exception to the "one family" rule above — used only
        // by RandomMealPuller's "Surprise me" tag, styled like a handwritten
        // note rather than app chrome.
        handwritten: ["Caveat_700Bold"],
      },
      fontSize: {
        // Real type scale (2026-08-19). "sub" was given as "10px / 10px",
        // read as font-size/line-height (tight leading for small text).
        hero: ["70px", { lineHeight: "76px" }],
        subhero: ["55px", { lineHeight: "59px" }],
        heading: "24px",
        // Big screen titles (e.g. the Meal Planner's "Planning your week...").
        "heading-lg": ["30px", { lineHeight: "36px" }],
        subheading: "18px",
        body: "14px",
        // Larger reading text, e.g. recipe steps read mid-cook. Added 2026-10-07.
        "body-lg": ["16px", { lineHeight: "24px" }],
        sub: ["10px", { lineHeight: "10px" }],
        // A meal card's description text (12px/20px, 0.5px tracking).
        small: ["13px", { lineHeight: "20px", letterSpacing: "0.5px" }],
      },
      letterSpacing: {
        // Tight display tracking for extrabold section titles (meal detail's
        // "Nutrition." etc.), from the show reel's -0.05em at the 24px
        // heading size. Added 2026-10-10.
        display: "-1.2px",
      },
    },
  },
  plugins: [],
};
