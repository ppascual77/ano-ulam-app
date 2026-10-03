# AnoUlam Mobile App — Development Context

## 1. Project Overview

AnoUlam is a Filipino food and meal-planning application.

The existing AnoUlam web app already has meal/recipe-related functionality, but the new mobile app is being developed with a much stronger emphasis on having a reliable, structured, grounded food-data foundation.

The goal is NOT to simply build a UI around AI-generated recipes.

The goal is to build a trustworthy underlying food intelligence/data system that can eventually support:

- Meal planning
- Recipe discovery
- Nutrition calculation
- Pantry management
- Grocery lists
- Procurement
- Ingredient price tracking
- Budget-aware meal planning
- Macro-aware meal planning
- Ingredient substitutions
- Other future food/meal intelligence features

The quality of the underlying data is therefore extremely important.

---

# 2. Current Development Strategy

The mobile app will be developed from the DATA FOUNDATION upward.

The current development order is:

1. Define the Ingredient data structure
2. Build an initial canonical ingredient database
3. Ground ingredient nutrition data using credible references
4. Validate and clean the data
5. Define the Meal structure
6. Create seed/test meals
7. Resolve meal ingredients against the canonical ingredient database
8. Link meals to canonical ingredients
9. Calculate meal nutrition from ingredient quantities
10. Build procurement/price functionality on top of the same ingredient foundation
11. Build the consumer-facing features on top of this foundation

Do not jump ahead to UI/features unless necessary.

---

# 3. Immediate Goal

I currently do NOT have a finalized recipe database.

Therefore, I cannot derive the initial ingredient list from existing recipes.

Instead, the immediate plan is:

### Build an initial list of approximately 500 common ingredients.

The list should be oriented toward:

- Filipino cooking
- Filipino households
- Common Asian ingredients used in Filipino cooking
- Common proteins
- Seafood
- Vegetables
- Fruits
- Aromatics
- Herbs
- Spices
- Condiments
- Sauces
- Pantry staples
- Cooking ingredients
- Dairy
- Eggs
- Grains
- Legumes
- Other ingredients likely to appear in Filipino recipes

The target of ~500 is an initial foundation, NOT a permanent limit.

The database should be designed so it can easily grow beyond 500.

---

# 4. Canonical Ingredient Principle

The ingredient database must use CANONICAL INGREDIENTS.

An ingredient's identity should not be based on the exact wording used in a recipe.

For example, these may all need to resolve to a canonical ingredient:

- garlic
- minced garlic
- garlic cloves
- bawang
- fresh garlic

Potential canonical record:

    Garlic

The recipe-specific information should remain separate.

For example:

    ingredient_id: ING-00042
    quantity: 3
    unit: cloves
    preparation: minced

Therefore:

### Ingredient identity != Recipe ingredient instruction

The canonical ingredient represents WHAT the food is.

The meal ingredient represents HOW MUCH of it the recipe uses and how it is prepared.

---

# 5. Ingredient Architecture

The conceptual relationship should be:

    CANONICAL INGREDIENT
          |
          +-- Nutrition/reference data
          |
          +-- Aliases
          |
          +-- Classification
          |
          +-- Procurement data
          |
          +-- Price data
          |
          +-- Used by many meals


A meal should NOT duplicate the full ingredient object.

Instead:

    MEAL
      |
      +-- MEAL INGREDIENT
              |
              +-- ingredient_id
              +-- quantity
              +-- unit
              +-- preparation
              +-- optional recipe-specific information

This creates a many-to-many relationship:

    Meal <-> MealIngredient <-> Ingredient

---

# 6. Proposed Ingredient Data

The exact schema can be improved during implementation, but the conceptual fields include:

    ingredient_id
    canonical_name
    display_name
    aliases
    category
    food_group
    default_unit
    state

    nutrition:
        calories
        protein
        carbohydrates
        fat
        sugar
        fiber
        sodium
        etc.

    references:
        fnri_reference
        usda_reference

    source_priority
    verification_status
    confidence
    last_verified_at

The schema should be designed for extensibility.

Do not overfit it to the first 500 ingredients.

---

# 7. Nutrition Grounding

Nutrition data should be grounded in credible food composition references.

Primary sources:

### FNRI
Food and Nutrition Research Institute / Philippine food composition data.

FNRI should generally be preferred when an appropriate Philippine/local food match exists.

### USDA
USDA FoodData Central can be used when:

- FNRI does not contain the ingredient
- FNRI does not contain an appropriate equivalent
- Additional reference data is needed

The system must preserve provenance.

Do NOT simply merge or average FNRI and USDA values.

For every nutritional record, we should know:

- Which source supplied it
- Which specific food/reference it corresponds to
- What measurement basis was used
- Whether the match is exact or approximate
- Whether it has been manually verified

The objective is traceability.

---

# 8. Grounding / Matching Philosophy

AI can assist with:

- Ingredient normalization
- Alias detection
- Matching recipe ingredient text to canonical ingredients
- Suggesting likely FNRI/USDA matches
- Detecting duplicates
- Identifying ambiguous ingredients
- Flagging records for human review

AI should NOT be treated as the authoritative source of nutritional truth.

The authoritative data should come from the underlying references.

When a match is uncertain, the system should preserve that uncertainty rather than silently inventing a value.

Prefer:

    VERIFIED
    HIGH_CONFIDENCE
    NEEDS_REVIEW
    UNRESOLVED

over pretending every match is correct.

---

# 9. Ingredient Normalization

There should be a normalization pipeline between raw recipe text and canonical ingredients.

Conceptually:

    RAW RECIPE TEXT
          ↓
    PARSED INGREDIENT
          ↓
    NORMALIZED INGREDIENT
          ↓
    CANONICAL INGREDIENT
          ↓
    REFERENCE DATA

Examples:

    "2 cloves minced garlic"
              ↓
    name = garlic
    quantity = 2
    unit = cloves
    preparation = minced
              ↓
    ingredient_id = ING-00042

Do NOT use the raw ingredient string as the database identity.

---

# 10. Meal Seeder

Since the recipe database is not yet established, I want to create seed/test meals after the initial ingredient database exists.

The purpose of the seeder is NOT merely to insert fake meals.

It is an integration test for the data architecture.

Example:

    Chicken Adobo

    Ingredients:
    - chicken
    - soy sauce
    - vinegar
    - garlic
    - onion
    - bay leaf
    - black pepper
    - cooking oil

The seeder should verify:

1. The ingredient exists in the canonical ingredient database.
2. The ingredient can be resolved to an ingredient_id.
3. A MealIngredient relationship can be created.
4. Quantity and units can be stored.
5. Nutrition can be derived from the canonical ingredient.
6. Meal-level nutrition can be calculated.
7. No duplicate ingredient records are accidentally created.

The seeder should help expose flaws in the data model.

---

# 11. Important Data Separation

Do NOT combine nutrition/reference data and procurement/price data into one undifferentiated object.

These represent different concepts.

Nutrition:

    "What is this food?"

Procurement:

    "How do I buy this food?"

Price:

    "How much does this food cost at a particular place/time?"

Conceptually:

    INGREDIENT
       |
       +---- NUTRITION / FOOD COMPOSITION
       |
       +---- PROCUREMENT
                  |
                  +---- PRICE OBSERVATIONS

Nutrition is relatively stable.

Prices are dynamic.

This separation is important for future features such as Price Watch and budget-aware meal planning.

---

# 12. Future Procurement Layer

The eventual procurement system should be able to answer things such as:

- Where can this ingredient be purchased?
- What is the current/observed price?
- What unit is the price based on?
- What is the price history?
- What is the cheapest applicable option?
- How much would a meal cost?
- How much would a meal plan cost?
- Can the ingredients be grouped into a procurement list?

However, procurement is NOT the immediate priority.

The immediate priority is establishing a clean canonical ingredient foundation.

---

# 13. Core Architectural Principle

The most important principle is:

### Build the canonical food-data layer first.

Do not create isolated data structures for each future feature.

Future features should query/reference the same canonical data.

For example:

    Ingredient
        ↓
        ├── Meals
        ├── Nutrition
        ├── Pantry
        ├── Grocery List
        ├── Procurement
        ├── Prices
        ├── Meal Planning
        ├── Budget Calculation
        └── Macro Calculation

This should prevent data duplication and inconsistent representations of the same ingredient.

---

# 14. Initial 500 Ingredient Dataset

The initial 500 ingredients should be treated as a curated seed dataset.

They should prioritize practical relevance over arbitrary completeness.

Possible broad groups:

- Rice and grains
- Noodles and pasta
- Chicken
- Pork
- Beef
- Fish
- Seafood
- Eggs
- Dairy
- Vegetables
- Fruits
- Leafy greens
- Root vegetables
- Aromatics
- Herbs
- Spices
- Condiments
- Sauces
- Vinegars
- Oils
- Pantry staples
- Legumes
- Canned/processed common cooking ingredients
- Filipino-specific ingredients

The exact category system should be designed carefully rather than creating dozens of unnecessary categories.

---

# 15. Data Quality Requirements

Avoid silently making assumptions.

For every ingredient, we should be able to distinguish:

- Exact reference match
- Closest reference match
- Derived value
- Manually verified value
- Missing data
- Needs review

Units and food states are especially important.

For example:

    raw chicken
    cooked chicken
    fried chicken

should not automatically be treated as the same nutritional state.

Similarly:

    100 g
    1 cup
    1 piece
    1 tablespoon
    1 teaspoon

must not be treated as interchangeable without an appropriate conversion basis.

---

# 16. Development Philosophy

Prefer correctness and traceability over speed.

Do not build unnecessary complexity prematurely.

However, avoid shortcuts that will create significant migration/data-cleaning problems later.

When making architectural decisions, consider:

1. Data integrity
2. Traceability
3. Extensibility
4. Ease of validation
5. Ability to update reference data
6. Ability to recalculate meals
7. Avoiding duplicated data
8. Filipino food relevance
9. Practical implementation complexity

---

# 17. Current Milestone

The current milestone is:

### "Create a trustworthy canonical ingredient foundation."

The immediate deliverables should eventually be:

1. Ingredient schema
2. Initial ~500 canonical ingredients
3. FNRI/USDA reference mapping
4. Nutrition records
5. Aliases/normalization
6. Confidence/verification status
7. Seeder meals
8. MealIngredient relationships
9. Nutrition calculation from ingredients

Only after this foundation works reliably should we move aggressively into procurement and advanced mobile functionality.

---

# 18. How I Want Claude to Help

Act as a senior software/data architect working alongside me on AnoUlam.

When proposing implementations:

- Respect the architecture above.
- Point out flaws in my assumptions.
- Do not blindly agree with me.
- Prefer simple, robust structures.
- Think about future data growth.
- Think about data provenance.
- Think about migrations and maintainability.
- Explicitly identify ambiguous data situations.
- Do not invent nutrition/reference data.
- Do not treat AI-generated information as authoritative.
- Keep the initial implementation practical.

When there are multiple valid approaches, explain the tradeoffs and recommend one.

The current priority is the FOOD DATA FOUNDATION, not UI polish.

---

# 19. Immediate Task

Help me implement the first stage:

### Canonical Ingredient Foundation

Specifically:

1. Determine the appropriate database schema.
2. Determine the fields required for canonical ingredients.
3. Determine how FNRI and USDA references should be represented.
4. Determine how aliases and normalization should work.
5. Determine confidence/verification states.
6. Design the initial ~500 ingredient dataset structure.
7. Design the meal seeder that validates ingredient resolution and MealIngredient relationships.
8. Ensure the architecture can later support nutrition calculation and procurement without restructuring the entire database.

Do not assume that the first 500 ingredients will be the final list.

The system should make it easy to add the 501st, 1,000th, or 10,000th ingredient later.

---

# 20. Finalized `ingredients` Schema (decided 2026-08-30)

After working through the tradeoffs, the schema is **one flat table** — no separate `nutrition_facts`/`aliases`/`categories` tables, no JSONB nesting. Two decisions that make this work:

**Cooking state is part of canonical identity, not a variant of one ingredient.** "Chicken breast, raw" and "Chicken breast, cooked" are separate rows/separate canonical ingredients, unlike "garlic" vs. "minced garlic" (same food, just described differently — those collapse to one row). The distinction: a cutting/prep style doesn't change nutrition; a cooking-state transformation (moisture loss, fat rendering) genuinely does. This means nutrition is truly one-value-per-row, so no per-state nesting is needed.

**Nutrition basis is always per 100g, normalized at data-entry time** — even if the FNRI/USDA source reported it per 100mL (liquids). This keeps exactly one formula for meal nutrition calculation everywhere: `nutrient_amount = (grams_used / 100) * nutrient_per_100g`, never branching on basis unit.

**Unit conversion is two separate concerns, only one of which touches the database:**
- *Universal unit math* (1 L = 1000 mL, 1 cup = 240 mL, 1 tbsp = 15 mL, 1 kg = 1000 g) is ingredient-independent and lives in application code (e.g. `lib/units.ts`), never in the database.
- *The ingredient-specific bridge* from volume/count into weight is the only part that's actually about the ingredient, and it's one number per row, not several: `grams_per_ml` (covers true liquids via density AND granular solids like rice/flour/sugar via an empirical cooking-conversion value — same mechanism, sourced differently) and `grams_per_piece` (+ `piece_label` describing what "piece" means, e.g. "clove", "medium egg") for count-based units. Storing separate `grams_per_cup`/`grams_per_tbsp`/`grams_per_tsp` values directly (an earlier draft) was rejected — those could silently disagree with each other from data-entry error; deriving them all from one `grams_per_ml` plus the universal constants keeps them consistent by construction.

**Example conversions the seeder needs to handle:**
- `1 L coconut milk` → `1000 mL × grams_per_ml` → grams → scale nutrition per 100g
- `3 cloves garlic` → `3 × grams_per_piece` → grams → scale nutrition per 100g
- `500 g chicken breast` → already grams, no conversion step

**If a recipe's unit can't be resolved** (neither `grams_per_ml` nor `grams_per_piece` covers it), the seeder must fail loud and flag it as `NEEDS_REVIEW`/`UNRESOLVED` rather than guess a number — same "preserve uncertainty" principle as nutrition matching (section 8).

```sql
-- As actually implemented (see section 22 for role/price/basis additions
-- made after this was first written — this block is kept up to date).
create table ingredients (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  display_name text,
  aliases text[] not null default '{}',
  category text,
  food_group text,
  state text,                  -- "raw" | "cooked" | "fried" | "dried" | null
  role text,                   -- 'main' | 'pantry' — see section 22

  grams_per_ml numeric,
  grams_per_piece numeric,
  piece_label text,

  basis_amount numeric not null default 100,   -- explicit, not just an assumed convention — see section 22
  basis_unit text not null default 'g',
  calories numeric,
  protein numeric,
  carbohydrates numeric,
  fat numeric,
  sugar numeric,
  fiber numeric,
  sodium numeric,

  source text,                  -- 'FNRI' | 'USDA' | 'manual'
  source_ref_id text,
  source_description text,
  match_type text,              -- 'exact' | 'approximate'
  verification_status text not null default 'UNRESOLVED',  -- 'VERIFIED' | 'HIGH_CONFIDENCE' | 'NEEDS_REVIEW' | 'UNRESOLVED'
  last_verified_at timestamptz,

  estimated_price numeric,                 -- deliberate stopgap, see section 22 — not the final procurement system
  estimated_price_unit text,               -- e.g. 'kg', 'L', 'piece', 'pack'
  price_source text not null default 'manual',  -- 'manual' | 'price_watch'
  price_last_updated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`meal_ingredients` (the Meal↔Ingredient many-to-many join) is still a separate table regardless of any of the above — that's an unavoidable relationship, not a nesting choice: one ingredient is used by many meals at different quantities each time. Not yet finalized as of this writing — next step once ingredient seeding is underway.

Implemented as migrations `20260909121739_ingredients_init.sql`, `20260909121740_ingredients_rls.sql`, `20260909122628_ingredients_allow_manual_source.sql` (adds `'manual'` to the `source` check — see section 21). RLS: publicly readable (`using (true)` on select), no write policy yet — writes are service_role/direct-connection only for now, since there's no enforced admin role in the schema.

---

# 21. The `manual` Source, and the Grounding Review Workflow (decided 2026-08-30)

## Why a third source value, `manual`

Grounding (matching an ingredient against FNRI/USDA) won't find a confident match for every ingredient — some are Filipino-specific items USDA doesn't carry, some just won't match well. The rule: **when grounding finds nothing confident, keep whatever data the ingredient already has rather than nulling it out**, and label its `source` as `'manual'` so it's honest about not being grounded against an official reference. This is a real, checked value now (`source in ('FNRI', 'USDA', 'manual')`), not a gap in the schema.

## The initial seed intentionally has AI-estimated placeholder macros, not empty rows

The first design of the seed data left all nutrition columns `null` until a real grounding pass could populate them, reasoning that filling them from AI's general knowledge would be exactly the "AI as authoritative nutritional truth" problem section 8 warns against.

That was reconsidered: the seed instead ships with real, usable AI-estimated macro values per 100g, but explicitly marked `source = 'manual'` and `verification_status = 'NEEDS_REVIEW'` — honestly labeled as ungrounded rather than pretending to be verified. Reasoning: an ingredient with a labeled, honest placeholder is more useful right now (it lets the meal seeder and nutrition-calculation pipeline actually be tested end-to-end) than an ingredient with nothing at all, as long as the label makes clear it hasn't been checked against FNRI/USDA yet. This isn't "pretending every match is correct" (section 8's actual concern) — it's a clearly-tagged interim value, upgradeable later. A future FNRI/USDA grounding pass should overwrite these with real reference data wherever it finds a confident match; ingredients that never get a confident match simply stay `manual` rather than losing their data.

## Grounding is USDA-first for now, not both sources

The web app's existing "Manage Ingredients" admin flow already implements FNRI Import and USDA Grounding as separate actions. FNRI's existing structure is more manual/less API-groundable, so **only USDA grounding is being built for the mobile/new backend right now**; FNRI import is deferred until its data pipeline is cleaner. This doesn't change the schema (FNRI is still a valid `source` value) — it only affects which grounding tooling gets built first.

## The review-and-apply workflow to replicate (learned from the existing web app)

The existing web app's USDA grounding flow (screenshotted during this session) is a good reference for the tooling to build later:

1. **Seed identity first, ground later** — ingredients get their `canonical_name`/`aliases`/`category` populated before any nutrition matching runs. This is already how the current seed works.
2. **Grounding runs as a batch job with live progress** ("Fetching macros... 20/539 (4%)"), searching USDA per ingredient.
3. **Two distinct "no data" outcomes, not one** — critical distinction:
   - **`NONE` / no confident match**: USDA responded successfully but nothing matched well enough. A resolved outcome — the ingredient should stay `UNRESOLVED`/`manual`, not be retried automatically. ("No confident USDA match — resolve individually via Edit → Fetch from USDA, or leave for FNRI.")
   - **`ERROR`**: the USDA API call itself failed (network, auth, bad request). Not a "no match" conclusion — this should be retryable, not treated as settled.
4. **Confidence-based default selection, not blind bulk-apply**: matches come back tagged `HIGH`/`LOW` confidence (plus the `NONE`/`ERROR` cases above). `HIGH` confidence matches are pre-checked (opt-out to apply); `LOW` confidence matches are unchecked (opt-in — a human has to actively decide); `NONE`/`ERROR` rows have nothing to apply. A "Confirm N selected" action applies only the checked rows — running the grounding job itself **never** silently overwrites live data; applying is a separate, deliberate step.
5. **Never downgrade already-good data**: grounding should only be run against `UNRESOLVED`/`NEEDS_REVIEW` rows by default. A `VERIFIED`/`HIGH_CONFIDENCE` row (especially one already sourced from the preferred FNRI) should never get silently clobbered by a lower-priority USDA guess just because a grounding batch was rerun. A "force re-ground everything" action, if ever needed, must be a distinct, deliberate action — never the default button behavior.
6. Each matched row shows the actual matched reference name and value (e.g. "→ Papayas, raw (43 cal/100g, 4 units found)") — per-100g, consistent with section 20's basis decision — plus how many candidate matches were found, so ambiguous cases are visible rather than silently picking one.

Not yet built: the USDA API integration, confidence scoring, and this review/apply UI are future work — this section documents the target design, decided ahead of implementation.

---

# 22. `role`, Estimated Price, and Making the Nutrition Basis Explicit (decided 2026-08-30)

## `role`: 'main' vs 'pantry'

Matches the existing mock `IngredientType.type` concept already used elsewhere in the app: **`main`** is a headline ingredient you'd shop for specifically for a given meal (e.g. chicken breast); **`pantry`** is a staple usually already on hand (salt, cooking oil, garlic, rice, condiments). Stored as `role text check (role is null or role in ('main', 'pantry'))`.

**Update (2026-10-03):** `role` is a display label only (the Main / Pantry tag in meal details). It no longer decides what counts toward a meal's totals: `recomputeMealTotals` sums every quantified ingredient, pantry included, for both macros and price. Previously only `main` plus oils counted, which undercounted calories (sugar, coconut milk, sauces) and the real per-meal cost.

## Estimated price — a deliberate, flagged compromise

This one sits in real tension with section 11's principle that nutrition and price/procurement are separate concerns (nutrition is stable, price is dynamic, and price eventually needs full history/sourcing via Price Watch). Adding a single static price value directly on `ingredients` is exactly the kind of undifferentiated object that section 11 warns against as the *permanent* design.

The resolution: treat it the same way as the nutrition placeholders — a clearly-tagged, honest stopgap, not the final system. `estimated_price` + `estimated_price_unit` (denominated in whatever unit people actually shop in — `kg`, `L`, `piece`, `pack` — not forced into the per-100g nutrition basis, since nobody buys "100g of rice" at a store) + `price_source` (`'manual'` | `'price_watch'`, defaulting to `'manual'` since no price-grounding pipeline exists yet — unlike nutrition, there isn't currently a clear plan for *how* to ground this against real market data) + `price_last_updated_at`. When Price Watch grounding exists, this should migrate into its own `price_observations`-style table (per section 11's original vision — per-store/per-time price history), not stay bolted onto `ingredients` forever.

## Making "always per 100g" explicit instead of an unenforced assumption

Section 20 originally dropped `basis_amount`/`basis_unit` as columns, reasoning the value never varies so it wasn't worth storing. That was a mistake, caught during implementation: an unenforced convention that only exists in documentation is exactly the kind of silent-assumption risk section 15/16 warns against — nothing would catch a future import that's actually per-serving instead of per-100g. Restored as real columns: `basis_amount numeric not null default 100`, `basis_unit text not null default 'g'`.

## The seed's `grams_per_ml`/`grams_per_piece` are AI-estimated too, same as nutrition/price

Unlike nutrition and price, there's no provenance-tracking pair added for these (no `conversion_source` column) — no grounding pipeline is planned for unit conversions, they're expected to stay manual/cooking-reference values long-term rather than progressing through a verification pipeline the way nutrition does.

Implemented as migrations `20260909123703_ingredients_add_role_and_price.sql` and `20260909123842_ingredients_add_nutrition_basis.sql`, with `supabase/seed.sql` updated to populate all of the above for the 10 test ingredients.
