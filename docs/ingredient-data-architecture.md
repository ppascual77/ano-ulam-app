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
create table ingredients (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  display_name text,
  aliases text[] not null default '{}',
  category text,
  food_group text,
  state text,                  -- "raw" | "cooked" | "fried" | "dried" | null

  grams_per_ml numeric,
  grams_per_piece numeric,
  piece_label text,

  calories numeric,             -- all nutrition below is always per 100g
  protein numeric,
  carbohydrates numeric,
  fat numeric,
  sugar numeric,
  fiber numeric,
  sodium numeric,

  source text,                  -- 'FNRI' | 'USDA'
  source_ref_id text,
  source_description text,
  match_type text,              -- 'exact' | 'approximate'
  verification_status text,     -- 'VERIFIED' | 'HIGH_CONFIDENCE' | 'NEEDS_REVIEW' | 'UNRESOLVED'
  last_verified_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`meal_ingredients` (the Meal↔Ingredient many-to-many join) is still a separate table regardless of any of the above — that's an unavoidable relationship, not a nesting choice: one ingredient is used by many meals at different quantities each time. Not yet finalized as of this writing — next step once ingredient seeding is underway.
