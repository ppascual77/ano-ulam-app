#!/usr/bin/env python3
"""Rule-based sanity checks for AnoUlam ingredient batches.

Two modes:
  csv  - validate a CSV export of ingredient rows (e.g. a post-grounding
         review pasted from Supabase, or a table-editor export). Typical
         columns: canonical_name,display_name,role,state,calories,protein,
         carbohydrates,fat,sugar,fiber,sodium,estimated_price,
         estimated_price_unit,source,verification_status
         (extra/missing columns are tolerated; checks that need a missing
         column are skipped, not failed).
  seed - validate a supabase/seed_batch_*.sql file BEFORE it's applied,
         checking the project's explicit rule that every field must be
         filled in with AI-estimated values (source='manual',
         verification_status='NEEDS_REVIEW'), not left null pending
         grounding.

Usage:
  python3 check_ingredients.py csv <path.csv>
  python3 check_ingredients.py seed <path.sql>

Prints findings grouped by severity: MUST-FIX, REVIEW, INFO. Exit code is
1 if any MUST-FIX finding exists, else 0 - so it can gate a batch before
it's committed/applied if desired, but the skill mainly uses this for
human-readable output.
"""
import csv
import re
import sys
from collections import defaultdict

VALID_ROLE = {"main", "pantry"}
VALID_STATE = {"raw", "cooked", "fried", "dried"}
VALID_SOURCE = {"FNRI", "USDA", "manual"}
VALID_VERIFICATION = {"VERIFIED", "HIGH_CONFIDENCE", "NEEDS_REVIEW", "UNRESOLVED"}
VALID_PRICE_UNIT = {"g", "kg", "ml", "L"}

MACRO_FIELDS = ["calories", "protein", "carbohydrates", "fat", "sugar", "fiber", "sodium"]
# `state` deliberately excluded: raw/cooked/fried/dried genuinely doesn't
# apply to a bottled sauce, salt, or oil (confirmed by the project's own
# original seed — Soy sauce, Vinegar white, Bay leaf, Black pepper,
# Cooking oil, and Salt all use state=null on purpose). Still filled in
# for meat/fish/produce where it's meaningful — this just stops
# condiments/seasonings from being falsely flagged for omitting it.
REQUIRED_CSV_FIELDS = [
    "canonical_name", "role", "calories", "protein", "carbohydrates",
    "fat", "sodium", "estimated_price", "estimated_price_unit", "source",
    "verification_status",
]

FAT_DOMINANT_HINTS = ["skin", "fat", "lard", "bacon", "chicharon", "crackling", "marrow"]
ORGAN_HINTS = ["liver", "gizzard", "heart", "kidney", "intestine", "tripe"]
BLOOD_HINTS = ["blood", "dinuguan"]
# Processed/sauced/breaded items legitimately carry carbs and can legitimately
# be lower-protein per gram (sauce/breading/sugar dilutes the meat) — exclude
# them from the "plain meat" carb/protein floor checks below rather than
# flagging every cured product as suspicious.
PROCESSED_HINTS = [
    "sauce", "sisig", "tocino", "longganisa", "tapa", "breaded", "batter",
    "gravy", "adobo", "sweet", "cured", "marinated", "tinapa", "smoked",
    "fish ball", "crab stick", "imitation", "surimi", "kani",
]
# Bivalves and cephalopods genuinely store glycogen and carry real (if
# small) carbohydrate content, and aren't as protein-dense as vertebrate
# muscle per 100g — unlike a vertebrate "meat" cut, a few g of carbs or
# under-12g protein here isn't a sign of a wrong match. Excluded from the
# plain-meat carb/protein floor checks, same reasoning as PROCESSED_HINTS.
MOLLUSK_HINTS = ["squid", "octopus", "mussel", "oyster", "clam", "scallop", "snail"]
# The plain-meat carb/protein floor check (below) only means something for
# an actual cut of animal muscle. Every non-meat food group hit so far
# (eggs/dairy: lactose carbs, low protein by design; grains: carb-dominant
# by definition; vegetables: same) has produced a wall of false positives
# when this was an *exclusion* list — a new one was needed for every batch
# that wasn't meat or fish. Flipped to an *inclusion* signal instead: name
# must contain one of the species/animal-type words actually used across
# this project's meat/fish batches (poultry, pork, beef, fish & seafood).
# Every batch from eggs/dairy onward is non-meat, so this should rarely
# need new entries — add one only if a genuine new meat/fish canonical name
# doesn't already match.
MEAT_FISH_SPECIES_HINTS = [
    "chicken", "duck", "pork", "pig", "beef", "cow", "goat", "lamb",
    "milkfish", "bangus", "tilapia", "scad", "galunggong", "tuna", "mackerel",
    "catfish", "hito", "grouper", "lapu-lapu", "sardine", "anchovy", "dilis",
    "herring", "tuyo", "rabbitfish", "danggit", "mudfish", "dalag", "mullet",
    "banak", "marlin", "dory", "salmon", "shrimp", "hipon", "crab",
]


def is_blank(v):
    if v is None:
        return True
    s = str(v).strip().lower()
    return s in ("", "null", "none", "nan")


def to_float(v):
    if is_blank(v):
        return None
    try:
        return float(v)
    except ValueError:
        return None


class Findings:
    def __init__(self):
        self.items = defaultdict(list)  # severity -> [str]

    def add(self, severity, row_label, message):
        self.items[severity].append(f"[{row_label}] {message}")

    def report(self):
        order = ["MUST-FIX", "REVIEW", "INFO"]
        total = 0
        for sev in order:
            msgs = self.items[sev]
            if not msgs:
                continue
            print(f"\n=== {sev} ({len(msgs)}) ===")
            for m in msgs:
                print(f"  - {m}")
            total += len(msgs)
        if total == 0:
            print("No findings. Batch looks clean.")
        else:
            print(f"\nTotal findings: {total}")
        return 1 if self.items["MUST-FIX"] else 0


MEAT_FISH_FOOD_GROUPS = {"Meat & Poultry", "Fish & Seafood"}


def plausibility_checks(f, name, state, macro_vals, price, food_group=None):
    """Checks that apply to any ingredient row regardless of where it came
    from (a pasted post-grounding CSV, or a seed batch's own AI-estimated
    placeholder numbers before it's ever applied) — negative values,
    calorie/macro-math consistency, and category-plausibility heuristics by
    name keyword. Mutates `f` (a Findings instance) in place."""
    # Negative values.
    for field, val in macro_vals.items():
        if val is not None and val < 0:
            sev = "REVIEW" if val >= -1 else "MUST-FIX"
            f.add(sev, name, f"{field} = {val} is negative "
                  f"({'likely USDA by-difference rounding artifact, clamp to 0' if sev == 'REVIEW' else 'data corruption'})")
    if price is not None and price < 0:
        f.add("MUST-FIX", name, f"estimated_price = {price} is negative")

    # Calorie/macro-math consistency (Atwater factors). Fiber is counted
    # inside `carbohydrates` (standard label convention) but only
    # contributes ~2 kcal/g, not 4 like digestible carbs — ignoring that
    # overstates expected calories for any high-fiber food (grains, produce,
    # legumes) and would throw false MUST-FIX flags on correct data. Net out
    # the difference when fiber is known.
    cal = macro_vals.get("calories")
    p, c, fa = macro_vals.get("protein"), macro_vals.get("carbohydrates"), macro_vals.get("fat")
    fiber = macro_vals.get("fiber")
    if cal is not None and None not in (p, c, fa):
        expected = p * 4 + c * 4 + fa * 9
        if fiber is not None and fiber > 0:
            expected -= fiber * 2
        # Vinegar's calories come from acetic acid, which isn't captured by
        # protein/carb/fat at all — the project's own original seed already
        # accepts this mismatch for "Vinegar, white" (18 cal vs ~4
        # macro-derived) as correct, not a bug. Atwater math fundamentally
        # doesn't apply here, so skip the check rather than false-flag it.
        is_vinegar = "vinegar" in name.lower() or "suka" in name.lower()
        if cal > 1 and expected > 1 and not is_vinegar:
            diff_pct = abs(cal - expected) / max(cal, expected)
            if diff_pct > 0.35:
                f.add("MUST-FIX", name,
                      f"calories={cal} vs macro-derived={expected:.0f} ({diff_pct:.0%} off) — "
                      f"arithmetic doesn't add up, likely a mistyped/wrong value")
            elif diff_pct > 0.15:
                f.add("REVIEW", name,
                      f"calories={cal} vs macro-derived={expected:.0f} ({diff_pct:.0%} off) — worth a second look")

    # Category-plausibility heuristics by name keyword. Gated against
    # PROCESSED_HINTS throughout — a prepared product carrying an organ/fat/
    # blood word in its name (e.g. "Liver sauce", a Mang Tomas-style
    # condiment) isn't raw organ meat and shouldn't be held to that macro
    # shape; same reasoning already applied to the plain-meat check below.
    lname = name.lower()
    is_processed = any(h in lname for h in PROCESSED_HINTS)
    if any(h in lname for h in FAT_DOMINANT_HINTS) and not is_processed and None not in (p, fa):
        fat_kcal = fa * 9
        protein_kcal = p * 4
        if fat_kcal <= protein_kcal:
            f.add("REVIEW", name,
                  f"name suggests a fat-dominant cut but protein ({p}g/{protein_kcal:.0f}kcal) "
                  f">= fat ({fa}g/{fat_kcal:.0f}kcal) — possibly matched/estimated as a lean-meat record instead")
    if any(h in lname for h in ORGAN_HINTS) and not is_processed and None not in (p, fa):
        if p < fa:
            f.add("REVIEW", name,
                  f"name suggests organ meat, usually protein >= fat, but fat ({fa}g) > protein ({p}g) here")
    if any(h in lname for h in BLOOD_HINTS) and not is_processed and fa is not None and fa > 5:
        f.add("REVIEW", name, f"name suggests blood, expected very low fat, got fat={fa}g")

    is_meat_or_fish = (
        (food_group is not None and food_group in MEAT_FISH_FOOD_GROUPS)
        or (food_group is None and any(h in lname for h in MEAT_FISH_SPECIES_HINTS))
    )
    is_plain_meat = (
        is_meat_or_fish
        and not any(h in lname for h in FAT_DOMINANT_HINTS + ORGAN_HINTS + BLOOD_HINTS + PROCESSED_HINTS + MOLLUSK_HINTS)
        and (state or "").strip().lower() in ("raw", "cooked")
    )
    if is_plain_meat:
        if c is not None and c > 2:
            f.add("REVIEW", name,
                  f"plain {state} meat cut but carbohydrates={c}g — meat itself is near-zero carb; "
                  f"matched/estimated record may include sauce/breading/marinade")
        if p is not None and p < 12:
            f.add("REVIEW", name,
                  f"plain {state} meat cut but protein={p}g is unusually low for muscle tissue "
                  f"(compare to organ meats, often 15-21g) — record may actually be fat/skin")


def validate_csv(path):
    f = Findings()
    with open(path, newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))

    if not rows:
        print("CSV has no data rows.")
        return 0

    cols = set(rows[0].keys())
    seen_names = defaultdict(int)
    profile_map = defaultdict(list)  # rounded macro tuple -> [canonical_name]

    for row in rows:
        name = row.get("canonical_name", "?").strip() or "?"
        seen_names[name] += 1

        # 1. Required-field completeness (only for columns actually present).
        for field in REQUIRED_CSV_FIELDS:
            if field in cols and is_blank(row.get(field)):
                f.add("MUST-FIX", name, f"{field} is blank/null — every field must be filled per project rule")

        # 2-4. Negative values, calorie-math consistency, category-plausibility.
        macro_vals = {}
        for field in MACRO_FIELDS:
            if field not in cols:
                continue
            macro_vals[field] = to_float(row.get(field))
        price = to_float(row.get("estimated_price")) if "estimated_price" in cols else None
        food_group = row.get("food_group") if "food_group" in cols else None
        plausibility_checks(f, name, row.get("state", ""), macro_vals, price, food_group)

        # 5. Enum/unit validation.
        # is_blank (not raw truthiness) so a literal "null" string in a
        # pasted CSV is treated as absent, not as an actual invalid enum
        # value — state=null is legitimate for condiments/seasonings (see
        # REQUIRED_CSV_FIELDS above), and a source/verification_status a
        # USDA record simply didn't return shouldn't misreport as garbage.
        if "role" in cols and not is_blank(row.get("role")) and row["role"] not in VALID_ROLE:
            f.add("MUST-FIX", name, f"role='{row['role']}' not in {sorted(VALID_ROLE)}")
        if "state" in cols and not is_blank(row.get("state")) and row["state"] not in VALID_STATE:
            f.add("MUST-FIX", name, f"state='{row['state']}' not in {sorted(VALID_STATE)}")
        if "source" in cols and not is_blank(row.get("source")) and row["source"] not in VALID_SOURCE:
            f.add("MUST-FIX", name, f"source='{row['source']}' not in {sorted(VALID_SOURCE)}")
        if "verification_status" in cols and not is_blank(row.get("verification_status")) and row["verification_status"] not in VALID_VERIFICATION:
            f.add("MUST-FIX", name, f"verification_status='{row['verification_status']}' not in {sorted(VALID_VERIFICATION)}")
        if "estimated_price_unit" in cols and not is_blank(row.get("estimated_price_unit")) and row["estimated_price_unit"] not in VALID_PRICE_UNIT:
            f.add("MUST-FIX", name, f"estimated_price_unit='{row['estimated_price_unit']}' not in {sorted(VALID_PRICE_UNIT)} (matches DB CHECK constraint)")

        # 6. Source/verification tagging consistency.
        source = row.get("source", "")
        vstatus = row.get("verification_status", "")
        if source == "manual" and vstatus not in ("NEEDS_REVIEW", ""):
            f.add("REVIEW", name, f"source='manual' but verification_status='{vstatus}' (expected NEEDS_REVIEW)")
        if source in ("USDA", "FNRI") and vstatus == "NEEDS_REVIEW":
            f.add("INFO", name, f"source='{source}' but still NEEDS_REVIEW — fine if genuinely approximate, confirm it's intentional")

        # 7. Duplicate macro-profile fingerprint (catches shared/duplicate grounding matches).
        # Pure fats/oils are the one legitimate exception: real nutrition
        # data for any plain oil is ~884 kcal/100g fat, 0 everything else,
        # because that's what pure fat actually is — two different oils
        # sharing that exact profile is physically correct, not a sign
        # they were both matched to the same wrong record (unlike, say,
        # "whole chicken" and "ground chicken" sharing a profile, which was
        # a real bug). Skip fingerprinting rows that are ~100% fat.
        is_pure_fat = (
            macro_vals.get("protein") is not None and macro_vals.get("protein") <= 1
            and macro_vals.get("carbohydrates") is not None and macro_vals.get("carbohydrates") <= 1
            and macro_vals.get("fat") is not None and macro_vals.get("fat") >= 95
        )
        if not is_pure_fat and all(k in macro_vals and macro_vals[k] is not None for k in ["calories", "protein", "carbohydrates", "fat", "sodium"]):
            fingerprint = tuple(
                round(macro_vals[k], 2)
                for k in ["calories", "protein", "carbohydrates", "fat", "sugar", "fiber", "sodium"]
                if macro_vals.get(k) is not None
            )
            profile_map[fingerprint].append(name)

    # Duplicate canonical_name within this file.
    for name, count in seen_names.items():
        if count > 1:
            f.add("MUST-FIX", name, f"appears {count} times in this file — duplicate row")

    # Duplicate macro profile across different-named rows.
    for fingerprint, names in profile_map.items():
        distinct = sorted(set(names))
        if len(distinct) > 1:
            f.add("MUST-FIX", " / ".join(distinct),
                  f"identical macro profile {fingerprint} across different ingredients — "
                  f"likely both matched the same USDA/FNRI record when they shouldn't have")

    return f.report()


TUPLE_RE = re.compile(r"\(([^()]*(?:\([^()]*\)[^()]*)*)\)")


def split_sql_values(tuple_body):
    """Split a single VALUES (...) tuple body on top-level commas, respecting
    quoted strings and array[...] literals."""
    parts = []
    depth = 0
    in_str = False
    current = ""
    i = 0
    while i < len(tuple_body):
        ch = tuple_body[i]
        if in_str:
            current += ch
            if ch == "'" and (i + 1 >= len(tuple_body) or tuple_body[i + 1] != "'"):
                in_str = False
            elif ch == "'" and tuple_body[i + 1:i + 2] == "'":
                current += tuple_body[i + 1]
                i += 1
        elif ch == "'":
            in_str = True
            current += ch
        elif ch in "([":
            depth += 1
            current += ch
        elif ch in ")]":
            depth -= 1
            current += ch
        elif ch == "," and depth == 0:
            parts.append(current.strip())
            current = ""
        else:
            current += ch
        i += 1
    if current.strip():
        parts.append(current.strip())
    return parts


def validate_seed(path):
    f = Findings()
    with open(path, encoding="utf-8") as fh:
        text = fh.read()

    col_match = re.search(r"insert into public\.ingredients\s*\(([^)]+)\)\s*values", text, re.IGNORECASE | re.DOTALL)
    if not col_match:
        print("Could not find an `insert into public.ingredients (...) values` statement.")
        return 1
    columns = [c.strip() for c in col_match.group(1).split(",")]

    values_start = col_match.end()
    body = text[values_start:]
    tuples = TUPLE_RE.findall(body)

    if not tuples:
        print("Could not find any value tuples after VALUES.")
        return 1

    for idx, tup in enumerate(tuples, start=1):
        parts = split_sql_values(tup)
        if len(parts) != len(columns):
            f.add("MUST-FIX", f"row {idx}", f"{len(parts)} values but {len(columns)} columns declared — "
                  f"tuple likely malformed (check for a stray comma inside a string/array)")
            continue
        row = dict(zip(columns, parts))
        name = row.get("canonical_name", f"row {idx}").strip("' ")

        for col, val in row.items():
            if val.strip().lower() == "null":
                # These are legitimately optional even under the "fill everything" rule.
                # `state` specifically: raw/cooked/fried/dried doesn't apply to bottled
                # condiments/seasonings (Soy sauce, Vinegar white, Bay leaf, Black pepper,
                # Cooking oil, Salt all use null on purpose in the project's own seed).
                if col in ("grams_per_ml", "grams_per_piece", "piece_label", "display_name", "aliases", "state"):
                    continue
                f.add("MUST-FIX", name, f"{col} is null — project rule says every field must carry an AI-estimated value")

        if "source" in row and row["source"].strip("' ") != "manual":
            f.add("REVIEW", name, f"source='{row['source'].strip(chr(39))}' in a seed batch — seed batches are expected to be 'manual' pending grounding")
        if "verification_status" in row and row["verification_status"].strip("' ") != "NEEDS_REVIEW":
            f.add("REVIEW", name, f"verification_status='{row['verification_status'].strip(chr(39))}' — seed batches are expected to be NEEDS_REVIEW")

        macro_vals = {field: to_float(row[field]) for field in MACRO_FIELDS if field in row}
        price = to_float(row["estimated_price"]) if "estimated_price" in row else None
        state = row.get("state", "").strip("' ")
        food_group = row.get("food_group", "").strip("' ") or None
        plausibility_checks(f, name, state, macro_vals, price, food_group)

    return f.report()


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ("csv", "seed"):
        print(__doc__)
        sys.exit(2)
    mode, path = sys.argv[1], sys.argv[2]
    exit_code = validate_csv(path) if mode == "csv" else validate_seed(path)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
