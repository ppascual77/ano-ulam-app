---
name: validate-ingredients
description: Validate an AnoUlam ingredient batch — either a seed_batch_*.sql file before it's applied, or a CSV of grounded results (pasted from Supabase or a table-editor export) after "Ground from USDA" runs. Use whenever the user asks to validate/verify/check an ingredient batch, pastes a CSV of ingredient data for review, or before seeding a new batch to the DB.
---

# Validate ingredients

Ingredient data quality bugs here are silent and compounding — they feed a
meal's calculated macros and price, and a bad row doesn't look obviously
wrong in isolation (e.g. "Chicken thigh, raw" at 44g fat / 9.58g protein
reads fine until you compare it against gizzard's 17.66g protein and
realize a thigh should never be leaner than an organ). Don't eyeball a
batch by reading it top to bottom — run the checker script, then reason
about what it flags.

Two distinct points in the batch lifecycle need validation, and they check
different things:

## 1. Before seeding (`seed` mode)

Run this against a new `supabase/seed_batch_*.sql` file before it's applied
to the DB. The project's standing rule (confirmed directly by the user) is
that every field in a seed batch must carry an AI-estimated value —
macros, price, unit-conversion bridges — tagged `source='manual'`,
`verification_status='NEEDS_REVIEW'`. Nothing is left null pending
grounding; a null macro silently breaks meal-nutrition math downstream
instead of just being visibly approximate.

```
python3 .claude/skills/validate-ingredients/check_ingredients.py seed supabase/seed_batch_NN_category.sql
```

Checks: no unexpected nulls (only `grams_per_ml`/`grams_per_piece`/
`piece_label`/`display_name`/`aliases` are allowed to be null — everything
sold as a discrete piece needs `grams_per_piece`, but not everything is
sold that way), `source`/`verification_status` match the seed-batch
convention, no negative numeric values, and the column/value-tuple count
lines up (catches a stray comma breaking row alignment).

## 2. After grounding (`csv` mode)

Run this whenever USDA/FNRI grounding results come back — either the batch
`UsdaGroundingPanel` results or a per-ingredient re-ground — and the user
pastes a CSV to "verify"/"validate" it. Save the pasted CSV to a file in
the scratchpad directory first (it won't have a real path otherwise), then:

```
python3 .claude/skills/validate-ingredients/check_ingredients.py csv /path/to/pasted.csv
```

This mode exists because grounding's `classifyConfidence` (in
`supabase/functions/ground-ingredients-usda/index.ts`) only scores USDA
text-match relevance + word overlap — it has **no nutrition-plausibility
check**. A textually-confident match can still be the wrong food record.
This script is the plausibility check that pipeline is missing:

- **Negative values** — especially carbohydrates. USDA's "by difference"
  calculation can round slightly below zero in the source record; small
  negatives (`>= -1`) are flagged as a clamp-to-zero fix, larger negatives
  as real corruption.
- **Calorie/macro-math consistency** — `calories` should roughly equal
  `protein*4 + carbohydrates*4 + fat*9` (Atwater factors). A >35%
  mismatch usually means the wrong USDA record was matched (different food
  entirely), 15-35% is worth a second look.
- **Duplicate macro-profile fingerprint** — if two *different* canonical
  ingredients end up with byte-identical macros, they likely both matched
  the same generic USDA record when they shouldn't have (e.g. "whole
  chicken" and "ground chicken" both landing on "chicken, meat only").
- **Category-plausibility heuristics by name keyword** — a name containing
  "skin"/"fat"/"lard"/"chicharon" should be fat-dominant by calories, not
  protein-dominant; a name containing "liver"/"gizzard"/"heart"/"kidney"
  (organ meat) should have protein >= fat; "blood" should be near-zero
  fat. These are heuristics, not ground truth — flag for human review,
  don't auto-correct.
- **Enum/unit validity** — `role`, `state`, `source`, `verification_status`,
  `estimated_price_unit` against the actual DB constraints (the latter is
  a real CHECK constraint: only `g`/`kg`/`ml`/`L`, see
  `supabase/migrations/20260909135148_ingredients_constrain_price_unit.sql`).
- **Source/verification tagging consistency** — `manual` should pair with
  `NEEDS_REVIEW`; a `USDA`/`FNRI` row still marked `NEEDS_REVIEW` isn't
  necessarily wrong (approximate matches get downgraded deliberately) but
  is surfaced as an FYI, not a hard failure.
- **Required-field completeness** — same "nothing left blank" rule as seed
  mode, checked against whatever columns are actually present in the CSV.

## After running

Report findings grouped by severity (MUST-FIX / REVIEW / INFO), in plain
language tied to the actual row and numbers — not just "3 issues found."
For MUST-FIX findings that look like a wrong USDA candidate match (macro
math way off, implausible category profile, duplicate profile), recommend
re-running "Fetch from USDA" for that ingredient in `IngredientEditSheet`
and picking a different candidate from the multi-candidate picker, or
fixing the value by hand if no better USDA record exists — never silently
auto-apply a fix to the database yourself; this script only reports.
