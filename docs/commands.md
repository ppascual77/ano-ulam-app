# Commands cheat sheet

Run everything from the project folder (`ano-ulam-mobile`).

## Daily development

| Command | What it does |
| --- | --- |
| `npx expo start --dev-client` | Starts the dev server for your dev build. Open AnoUlam on the phone and it loads from your Mac. JS changes reload in seconds. |
| `npx expo start --dev-client --no-dev --minify` | Same, but runs the JavaScript in production mode: closer to real speed. No Fast Refresh or error overlay. Use it to judge sluggishness. |
| `npm run tunnel` | Dev server over a tunnel instead of Wi-Fi, for when the phone can't reach your Mac on the network. |
| `npx tsc --noEmit -p .` | Type-checks the whole app. No output means no errors. |

## Builds (EAS, in the cloud)

| Command | What it does |
| --- | --- |
| `eas build --profile development --platform ios` | New **dev build**. Only needed after adding or upgrading a native package, or changing `app.json` (permissions, icon, plugins). |
| `eas build --profile production --platform ios` | **Production build**: the real App Store app (fast, no dev tools). Build number goes up automatically. |
| `eas submit --platform ios --latest` | Uploads the newest build to App Store Connect, where it shows up in TestFlight after processing (5 to 30 min). |
| `eas build:list` | Lists your builds and their status. |

A TestFlight build is a fixed snapshot: every code change needs a new production build and submit. Keep coding in the dev build; use TestFlight at checkpoints.

## EAS environment variables

The app's `EXPO_PUBLIC_` keys live in `.env` for dev builds, and in EAS for preview/production builds (`.env` isn't uploaded).

| Command | What it does |
| --- | --- |
| `eas env:list --environment production` | Shows which variables a build environment has. |
| `eas env:create --name KEY --value "..." --environment preview --environment production --visibility sensitive --force` | Adds or overwrites a variable. Do this whenever a key in `.env` changes. |

## Supabase: database

| Command | What it does |
| --- | --- |
| `supabase migration list` | Compares local migration files with what's applied live. An empty "Remote" column = not applied yet. |
| `supabase db push --dry-run` | Shows which migrations would be applied, without applying. |
| `supabase db push` | Applies new migrations to the live database. |
| `supabase db query --linked "select ..."` | Runs SQL against the live database. |
| `supabase migration repair --status applied <version>` | Marks a migration as applied in the history (only when its changes are already live). |

After any schema change, regenerate `lib/database.types.ts` (see the comment at the top of that file for the exact command).

## Supabase: edge functions

| Command | What it does |
| --- | --- |
| `supabase functions deploy <name> --use-api` | Deploys one edge function (e.g. `klipy`, `import-meal-from-url`). Needed after every change to its code. `--use-api` bundles without Docker. |
| `supabase secrets set NAME=value` | Sets a server secret for edge functions (e.g. `KLIPY_API_KEY`, `OPENAI_API_KEY`). Can't be read back afterwards, so keep a copy in `.env`. |
| `supabase secrets list` | Lists secret names (not values). |

## Git

| Command | What it does |
| --- | --- |
| `git checkout main && git checkout -b <type>/<short-desc>` | New branch from `main`, e.g. `fix/posting-indicator`. |
| `git add -A && git commit -m "short imperative message"` | Commits everything. |
| `git push origin main` | Pushes `main` to GitHub. |
| `git checkout main && git merge --no-ff <branch>` | Merges a finished branch into `main`. |

## Where things are

- `docs/to-test.md`: the device test checklist.
- `docs/integration-status.md`: what's real, what's left, the before-release list.
- `docs/compliance.md`: App Store, EU and BIR notes.
