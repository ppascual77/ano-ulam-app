# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.
Currently pinned to Expo SDK 54 because the public App Store build of Expo Go is stuck there
(Apple review backlog on newer SDKs, no ETA as of 2026-08-19). Re-check this before assuming a
later SDK is safe to upgrade to — verify Expo Go's actual store version, don't just trust the docs.

# Folder structure

- `app/` — Expo Router routing ONLY. File path = route. Route files re-export their screen from
  `features/*/screens/`, e.g. `app/index.tsx` is just
  `export { default } from "@/features/home/screens/HomeScreen";` — no UI/logic lives directly
  in `app/`. Exception: `_layout.tsx` files (providers, fonts, tab bar setup) stay in `app/`
  as-is since there's no feature to colocate them with.
- `features/<name>/` — one folder per *routable* domain, holds everything needed to render that
  domain's screen(s):
  - `screens/` — the actual screen component(s) that `app/` re-exports
  - `components/` — UI used only within this feature
  - `hooks/`, `api.ts` — as needed
  Current features: `home/`, `onboarding/`, `auth/`, `browse/`, `discover/`, `meal-planner/`,
  `price-watch/`. Create a new feature folder only when actually building that feature — don't
  pre-scaffold empty ones.
- `core/<name>/` — a shared *business domain* with no screen of its own, consumed by one or more
  `features/*` screens (e.g. `core/meals/`, used by Home's Recommendations/Community Favorites
  and eventually Discover). Holds everything for that domain in one place — types, calculation/
  rule functions, mock data, *and* its presentational components (in a `components/` subfolder,
  e.g. `core/meals/components/MealCard.tsx`) — rather than splitting logic and UI into separate
  top-level trees. If a domain's logic/components are only ever used by a single feature, keep
  them inside that feature instead of creating a `core/` folder for it — this is for things
  actually shared across features.
- `components/ui/` — generic, app-agnostic primitives (`Screen`, `AppText`, `Button`, `Card`).
  No feature/business logic here. Exported via `components/ui/index.ts` — import as
  `import { Button } from "@/components/ui"`.
- `components/navigation/` — app-wide navigation chrome (`BottomNav`) that isn't a generic
  primitive and isn't tied to one business domain, so it doesn't fit `components/ui/` or a
  `core/<name>/`.
- `constants/theme.ts` — raw brand values (hex colors, font names) for contexts that can't take
  a `className` (StatusBar config, splash screen, chart libraries). Keep in sync with the color
  values in `tailwind.config.js` by hand — small enough duplication that a build-time sync isn't
  worth the complexity.
- `lib/` — not created yet; add it when wiring up Supabase/Posthog clients. Don't pre-scaffold.
- `@/*` path alias resolves to the project root (see `tsconfig.json`) — prefer
  `@/features/home/screens/HomeScreen` over relative `../../` imports for anything outside the
  current file's own folder.

# UI conventions

- Style with NativeWind `className` (Tailwind syntax), not `StyleSheet.create`, to match the
  web app's styling mental model.
- Reach for `components/ui` primitives before writing raw `<View>`/`<Text>`/`<Pressable>` in a
  screen. If a screen needs a new variant, extend the primitive's variant map rather than
  one-off styling inline.
- Every screen's root should be `<Screen>` (handles safe-area insets + base padding), not a
  raw `<View>`.
- Before creating any new component (in `components/ui` or inside a `features/*/components/`),
  check whether something close enough already exists — in `components/ui` first, then in the
  current feature's own `components/`, then in sibling features if the need looks generic
  enough to belong in `components/ui` instead. If something close exists, ask whether to reuse
  it (extending its variants/props if needed) or whether a separate component is actually
  warranted, rather than creating a new one by default.
- Never invent a color or size value inline. Colors, font sizes, and font weights must come
  from the tokens already defined in `tailwind.config.js` (`primary`, `accent`, `ink`/
  `ink.subtle`/`ink.emphasis`, `text-hero`/`text-heading`/`text-subheading`/`text-body`/
  `text-sub`, `font-inter-*`). If a screen seems to need a color or size that isn't one of
  these tokens, stop and ask whether to add it to `tailwind.config.js` (and
  `constants/theme.ts`) rather than reaching for an arbitrary Tailwind value
  (e.g. `text-[13px]`, `bg-[#123456]`) or a default Tailwind color (e.g. `text-gray-500`).

# Git workflow

- `main` is always deployable/demoable. Always branch out from `main`, never from another
  feature branch.
- Before starting new work, ask what kind of change it is — feat / improvement / fix / chore /
  etc. — and use that to name the branch: `<type>/<short-desc>`, e.g. `feat/onboarding-screen`,
  `fix/font-loading-flash`, `chore/upgrade-expo-sdk`. Don't guess the type silently.
- Solo project, so branching is about keeping diffs reviewable and history legible, not process
  for its own sake.
- Commit messages: short imperative subject line (`add meal suggestion card`, `fix splash
  screen flash on cold start`), no strict conventional-commits prefix required.
