---
name: seed-meal
description: Seed AnoUlam meals from recipe URLs together with Patrick. One URL runs interactively; 2 to 5 URLs run batch mode (unattended prep by meal-prep subagents, then one review sitting). Imports the recipe, checks for duplicates, proposes a link for every ingredient (match, quantity, macros source, price source, bridges) for him to approve one at a time, verifies (armours) what he approves, writes the steps and description fresh in our own words, runs the app's calculation and copy checks, gets a fresh-eyes credibility review, and saves the meal to the catalog. Use when he runs /seed-meal <url> or asks to seed/import a meal through the agent instead of the admin Seed Meal screen.
---

# Seed a meal, together

The admin Seed Meal screen stays the manual path. This skill is the same process (the same `api/` and admin utils code, run through the tool below) with you as the second pair of eyes. The exhausting part of seeding by hand is linking ingredients one by one with nobody checking. Your job is to do the legwork, show your evidence, and let Patrick decide.

**You propose, Patrick approves.** Never link, verify, change or save anything he hasn't approved in this conversation.

## The tool

Every step goes through one command (allow it once):

```
.claude/skills/seed-meal/seed <command> [args...]
```

| Command | What it does |
|---|---|
| `import <url>` | Imports with the same edge function as Seed Meal, starts a session, checks duplicates (same link, similar names) |
| `lines` | Every line: recipe name and wording, parsed quantity, link + armour, or top candidates |
| `candidates <line-key or text>` | Local matches with full detail (state, macros + source, price + sources, bridges, armour) |
| `ingredient <id>` | One ingredient in full, its DA commodities, and every meal using it |
| `usda <name>` / `estimate <name>` | USDA lookup / AI estimate for an ingredient we don't have |
| `link <key> <id> [amount] [unit]` | Link a line (units: g, kg, ml, L, piece) |
| `set-line <key> <json>` | Change a line: `quantityAmount`, `quantityUnit`, `note`, `section`, `priceQuantityAmount`, `priceQuantityUnit`, `displayText`, `name` |
| `add-line <json>` / `remove-line <key>` | A line the import missed or got wrong |
| `approve <key...>` | Record Patrick's approval of lines |
| `armour <id> <macros,price,piece,density> [--note "source"]` | Mark approved values verified (no value change) |
| `update-ingredient <id> <json>` | Change ingredient values (recomputes every saved meal using it) |
| `create-ingredient <json>` | New ingredient (defaults: manual, NEEDS_REVIEW) |
| `prices <id>` / `apply-prices <id> <0,1>` | Supermarket listing search / apply chosen listings |
| `da-search <text>` / `da-link <commodity-id> <id>` | Find / link a DA commodity (re-picks the cheapest price) |
| `calc` | The app's calculation check, per line and totals |
| `source` | The source page's own description + steps (for the copy check, never to copy from) |
| `meal-times <meal-id> <breakfast,lunch,dinner \| none>` | Set meal times on an already-saved meal (and refresh its pill tags) |
| `set-meal <json>` | Meal fields: `mealTimes` (breakfast, lunch, dinner; stored in tags, other tags kept), `servingSize`, `prepTime`, `totalTime`, `difficulty` (array), `proteinType`, `budgetRange`, `dietaryTags`, `tags`, `allergens` (nuts, gluten, dairy, egg, shellfish, fish, soy, coconut, sesame) |
| `set-copy <json>` / `copy-check` / `approve-copy` | Replace description/steps, run the 8-word copy check, record approval |
| `preview` | The meal as a user sees it (input for the review) |
| `mark-reviewed` | Record that the fresh-eyes review is done and its concerns handled |
| `image` | Generate our own image (source photo is only a private reference) |
| `attach-image` | Set the image on a meal this session already saved |
| `status` / `save` / `use <file>` | Progress, save (refuses until every gate passes), resume a session |
| `--session <file> <command>` | Run any command on that session instead of the current one (batch mode) |
| `batch-start <urls...>` / `batch-status` | Import up to 5 into a batch / one-line summary per meal |
| `note <key> <json>` | Prep's evidence for a line: `{"confidence":"high\|medium\|low","why":"...","flag":"..."}` |
| `propose-fix <json>` / `fixes [batch]` / `apply-fix <id>` / `drop-fix <id>` | Proposed ingredient changes (`update`, `prices`, `da-link`, `create`), applied only after approval |
| `set-review -` / `review` | Store / show the reviewer's answer |
| `approve-all` / `armour-approved` | Approve every linked line / verify what the approved lines use |

JSON args can be inline, `-` with a quoted heredoc, or a path to a .json file.

**Command shape:** the allow rule only matches commands that *start* with `.claude/skills/seed-meal/seed`. Every Bash call (yours and the prep agents') is exactly one such command: no `cd`, no variables like `T=...; $T`, no `&&` / `;` chaining, no pipes. Run independent lookups as parallel Bash calls instead. Anything else interrupts Patrick with a permission prompt, which defeats batch mode.

## Batch mode (2 to 5 URLs)

`/seed-meal <url1> <url2> ...` with more than one URL. More than 5: take the first 5 and say so.

Patrick starts it and walks away. **Prep asks nothing.** The first thing he sees when he's back is one "ready?" prompt.

### Prep (unattended)
1. `batch-start <urls...>`: imports each into its own session, flags same-link and same-dish duplicates (in the batch and the catalog), records failures. Don't stop for duplicates; they go in the review.
2. Spawn one **meal-prep** subagent per session, 2 or 3 at a time (`run_in_background: true`), each prompted with just: *"Prepare the meal in session file `<path>`."* Wait for each batch of agents before spawning more. They link lines in their session file, write notes and flags, propose fixes, fix plain meal facts, write the copy, generate the image. They write nothing shared.
3. When a prep agent finishes: run `--session <file> preview` and spawn the **meal-credibility-reviewer** with only that preview (same no-hints rule as below), then store its answer with `--session <file> set-review - <<'EOF' ... EOF`.
4. Keep each prep report's side issues for the follow-up list.
5. When every meal is prepped and reviewed, `batch-status` and `fixes batch`, then the first prompt.

### Review (Patrick is back)
All tables go in AskUserQuestion option `preview`s (the question box hides the chat). Keep question text to one short line.

1. **Ready?** One question, preview = the `batch-status` summary as a table (meal, lines, flags, ₱ and kcal per serving, review verdict, duplicates, failed imports). Options: **Start review** / **Later**.
2. **Shared fixes** (skip if none). One question per fix group from `fixes batch` (up to 4 per call), preview = what changes, why, which meals. Options: **Apply** / **Skip**. Apply with `--session <file> apply-fix <id>` once per group; it marks the twins in other meals applied. A skipped fix: `drop-fix` in each session, and its lines stay flagged.
3. **One call per meal**, up to 4 questions as tabs, one submit:
   - **Lines:** table of every line (recipe text, pick, counted amount, line ₱, prep's flags marked ⚠), plus the meal times prep set (e.g. "Meal time: lunch, dinner"). Approve all / Change some.
   - **Steps:** source vs ours, side by side. Approve / Change some.
   - **Review:** the reviewer's verdict and concerns, sorted into concerns and challenges to verified values (`lines` shows ✓), each with your one-line view. Options to accept the suggested changes or keep as is; he can type specifics.
   - **Image:** say it's ready and where; show it with Read right before this call. Use / Regenerate / Skip.
   Then apply his answers: line changes (`link`, `set-line`, re-run `calc`; only re-run the reviewer for a big change like a different main ingredient or servings), `set-meal` / `set-copy` for accepted review points, and on approval `approve-all`, `armour-approved`, `approve-copy`, `mark-reviewed`. Regenerate → `image`, then show it again in the next call.
4. **Save.** One question, preview = what gets saved (meal, ₱ and kcal per serving, image yes/no) and the follow-up list. Options: **Save all ready meals** / **Pick** (he types which). `--session <file> save` for each.

A meal that isn't ready (unlinked lines, a skipped fix it needs, calc errors) stays unsaved; say so and leave its session for a later `/seed-meal` sitting with `use <file>`.

## The flow (one URL)

### 1. Import and duplicates
Run `import <url>`. Tell Patrick the dish, servings and times in one or two lines.
- **Duplicate link or similar meal:** stop and ask whether to continue (AskUserQuestion).
- **"NO source text":** the copy check can't run and save will be blocked. Say so up front; `import-meal-from-url` needs a redeploy.

### 2. The ingredient list
Run `lines` and show Patrick the full list as a short table: recipe line → your proposed match, with **✓** for fully verified ingredients (macros, price, and the bridge this line uses all armoured).

### 3 + 4. Research every line, then one table to approve
One question per line was too slow (Patrick, first run). Research **all** lines first (batch the `ingredient` / `candidates` calls into one tool call), then ask **once** with a table of every line: recipe text, your pick, counted amount, line ₱. Put that table in the AskUserQuestion option's `preview` (the question box covers the chat, so a table above it can't be seen), with options **Approve all** / **Change some** (he types line numbers and changes). Fixes a line needs to work (e.g. a broken price) go in the same preview. Lines with a genuinely open choice (two equally good entries) can be a second question in the same call.

Side issues that don't block this meal (duplicate entries, a DA link that would be nicer, overlapping aliases) go on a **follow-up list** shown at save time, never as a question mid-review.

For each line, investigate:
1. `candidates` for the line (try the Tagalog and English names). `ingredient <id>` for the one you'd pick, to see its data and which meals use it.
2. Decide the **match** from the recipe's own words: state and form must fit (raw vs cooked, fresh vs dried, canned/drained vs dry, leaves vs whole, the cut). Word overlap alone is not a match.
3. Decide the **quantity** from the recipe text only. Convert cups/tbsp through the ingredient's grams per ml (1 cup = 240 ml, 1 tbsp = 15 ml, 1 tsp = 5 ml). Size words ("large onion", "small tomato") change this line's quantity in grams, never the shared piece weight. "To taste"/"for garnish"/"pinch" lines get no quantity.
4. Check the ingredient's **macros source** (USDA/FNRI reference record vs manual estimate; does the record fit, e.g. not a cooked record for a raw ingredient), **price source** (listings, DA commodity, or estimate; per kg/L, sane for 2026 Philippines), and the **bridge this line needs** (piece weight for pieces, grams per ml for volumes on a per-gram ingredient).
5. When a single line does need its own question, keep the evidence out of the question text (the box renders it as one hard-to-read line). Put it in the option's `preview` as a small aligned block, like this card:

   ```
   **2 cloves garlic → Garlic, raw**

   | | |
   |---|---|
   | Counted as | 2 pieces = 10 g |
   | Macros | USDA #169230, raw · 149 kcal per 100 g |
   | Price | ₱180/kg · DA |
   | Bridge | 5 g per clove |
   | Line cost | ≈ ₱1.80 |

   Why: recipe says minced cloves, so raw garlic, not fried.
   ```

   Then ask with AskUserQuestion: a short question (e.g. *"Garlic line: approve?"*), header = the ingredient, options **Approve** (Recommended, when you're confident), **Pick another**, **Edit quantity**, each with a one-phrase description. Patrick can always type something else.
   - If something on the ingredient itself looks wrong (a bad bridge, a cooked USDA record on a raw ingredient, a pack-estimate price), say so in the question and propose the exact fix. Fixing it is a separate approval.
6. On approval: `link` (if not already), `approve <key>`, then `armour <id> ...` for what Patrick just approved on that ingredient: `macros` and `price` when he approved them, plus `piece` or `density` when this line uses that bridge (add `--note` with where the bridge number came from, e.g. "USDA: 1 medium = 110 g"). Never armour something he didn't look at.
7. "Pick another": show the next 2-3 candidates with the same evidence, or search USDA / create a new ingredient if none fit (creating is its own approval: show the full proposed row first).

**Changing a shared ingredient** (`update-ingredient`, `apply-prices`, `da-link`, `create-ingredient`) affects every meal using it: run `ingredient <id>` first and tell Patrick which meals will be recomputed. A verified field only changes if the patch also re-stamps its lock (e.g. `{"grams_per_piece": 110, "piece_verified_at": "<now ISO>"}`), and only after Patrick explicitly approved changing a verified value.

Put your proposed **meal time** (breakfast, lunch, dinner; any that fit, most ulam are lunch + dinner) in the same lines preview, and set it with `set-meal '{"mealTimes":[...]}'` once approved. It drives Home's Breakfast / Lunch / Dinner categories.

### 5. Calculation check
Run `calc` once every line is linked. Errors block saving: fix their cause (with Patrick) instead of adjusting a quantity to make it pass. Read the per-line kcal and ₱ for anything odd (salt being the priciest line, a vegetable at 1 kg for 4 servings) and raise it.

### 6. Steps and description, in our own words
What we can use from the source: the dish name, the ingredient list and amounts, servings, times, and the cooking method. Those are facts. What we never take: the source's wording, its story/headnote, tips, and photos.

- Write the **steps fresh** from *our* linked ingredient list, amounts and sections, in plain, friendly English for a Filipino home cook. Don't paraphrase the source line by line; work out the method, then write it your own way. Keep every distinct sub-step of the method (don't drop or merge real steps). Every listed ingredient appears in the steps; no step uses something unlisted.
- Write the **description fresh** from the dish's facts (what it is, how it tastes, why it's a good budget ulam). Never a reworded headnote.
- `set-copy` it, run `copy-check` (must pass: no 8+ word run shared with `source`; aim for no overlap at all), then show Patrick the source steps and yours side by side and ask per step: **Approve / Edit / Rewrite**. When all are approved, `approve-copy`.

### 7. Fresh-eyes review
Run `preview` and spawn the **meal-credibility-reviewer** subagent with only that preview text as its prompt. Add nothing: not this conversation, not the source, not your reasoning, and never what's verified or that anything was already checked. Any hint like that biases it toward agreeing.

When it answers, sort its concerns yourself (`lines` shows the armour): concerns about counted amounts, links, steps or totals, and **challenges to verified values** (macros, price or a bridge Patrick already approved). Show Patrick the verdict with the two groups labelled. Discuss each one like a line review; for a verified challenge, also check the source record, DA price or listing before giving your view. Change a verified value only if he says so, through `update-ingredient` with the lock re-stamped. If he keeps it, move on and don't re-raise it this session. Fix what he agrees with (re-run `calc` / `copy-check` if anything changed), then `mark-reviewed`.

### 8. Image
Ask whether to generate an image. If yes, run `image` and show it to him with the Read tool. Regenerate on request. Skipping is fine (he can add one in Edit Meal).

### 9. Save
Run `status`, summarize what's about to be saved (name, lines, per-serving kcal and ₱), ask for a final OK, then `save`. It goes straight into the catalog as approved, records the source link privately (`meal_sources`), and uploads the image if there is one.

## Rules that always apply
- Only link to ingredient ids that exist. Never invent an id, a USDA record, a price or a listing.
- Macros and prices come from USDA, FNRI, DA or real listings. Never estimate a number when a source exists; when only an AI estimate is possible, say so plainly.
- Never change a quantity just to make a check pass.
- Never question a verified value in passing. If one really looks wrong, raise it as its own question.
- Keep chat short: the evidence for one decision at a time, not a dump of everything.
- If Patrick stops mid-way, the session file keeps everything; `use <file>` and `status` resume it.
