import { ReactNode, useEffect, useState } from "react";
import { View, ScrollView, Pressable, Linking } from "react-native";
import { ExternalLink } from "lucide-react-native";
import { AppText, BottomSheet, Button, ChipSelect, TextField } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import {
  applyUsdaMatch,
  getUsdaSourceUrl,
  groundIngredientsUsda,
  markUsdaGroundingAttempted,
  type IngredientRow,
  type UsdaGroundingResult,
} from "@/api/ingredients";

type Props = {
  visible: boolean;
  onClose: () => void;
  ingredient: IngredientRow | null;
  /** Prefill for creating a brand-new ingredient (e.g. an AI estimate) —
   *  used only when `ingredient` is null. */
  initialDraft?: (Partial<IngredientRow> & { canonical_name: string }) | null;
  onSave: (patch: Partial<IngredientRow>) => void;
  isSaving: boolean;
  /** Overrides the Save button's idle label — e.g. "Review" when the
   *  caller wants a confirmation step before this patch is actually
   *  persisted, rather than saving immediately. */
  saveLabel?: string;
  /** Fires once this sheet's close animation has actually finished — see
   *  BottomSheet's onClosed. Use this (not onSave itself) to trigger
   *  opening a second sheet right after, so the two are never both
   *  presented at once. */
  onClosed?: () => void;
};

const ROLE_OPTIONS = [
  { id: "main", label: "Main" },
  { id: "pantry", label: "Pantry" },
];
const STATE_OPTIONS = [
  { id: "raw", label: "Raw" },
  { id: "cooked", label: "Cooked" },
  { id: "fried", label: "Fried" },
  { id: "dried", label: "Dried" },
];
const SOURCE_OPTIONS = [
  { id: "FNRI", label: "FNRI" },
  { id: "USDA", label: "USDA" },
  { id: "manual", label: "Manual" },
];
const MATCH_TYPE_OPTIONS = [
  { id: "exact", label: "Exact" },
  { id: "approximate", label: "Approximate" },
];
const VERIFICATION_STATUS_OPTIONS = [
  { id: "VERIFIED", label: "Verified" },
  { id: "HIGH_CONFIDENCE", label: "High confidence" },
  { id: "NEEDS_REVIEW", label: "Needs review" },
  { id: "UNRESOLVED", label: "Unresolved" },
];
const PRICE_SOURCE_OPTIONS = [
  { id: "manual", label: "Manual" },
  { id: "price_watch", label: "Price Watch" },
];

// Every editable field is a string in local form state (TextInput's native
// value type) — converted to the right type only when building the save
// patch. Numeric fields save as null when left blank rather than 0/NaN.
type FormState = {
  canonical_name: string;
  display_name: string;
  aliases: string;
  category: string;
  food_group: string;
  role: string[];
  state: string[];
  estimated_price: string;
  estimated_price_unit: string;
  price_source: string[];
  basis_amount: string;
  basis_unit: string;
  calories: string;
  protein: string;
  carbohydrates: string;
  fat: string;
  sugar: string;
  fiber: string;
  sodium: string;
  source: string[];
  source_ref_id: string;
  source_description: string;
  match_type: string[];
  verification_status: string[];
  grams_per_ml: string;
  grams_per_piece: string;
  piece_label: string;
};

function toFormState(ingredient: IngredientRow): FormState {
  return {
    canonical_name: ingredient.canonical_name ?? "",
    display_name: ingredient.display_name ?? "",
    aliases: (ingredient.aliases ?? []).join(", "),
    category: ingredient.category ?? "",
    food_group: ingredient.food_group ?? "",
    role: ingredient.role ? [ingredient.role] : [],
    state: ingredient.state ? [ingredient.state] : [],
    estimated_price: ingredient.estimated_price?.toString() ?? "",
    estimated_price_unit: ingredient.estimated_price_unit ?? "",
    price_source: ingredient.price_source ? [ingredient.price_source] : [],
    basis_amount: ingredient.basis_amount?.toString() ?? "100",
    basis_unit: ingredient.basis_unit ?? "g",
    calories: ingredient.calories?.toString() ?? "",
    protein: ingredient.protein?.toString() ?? "",
    carbohydrates: ingredient.carbohydrates?.toString() ?? "",
    fat: ingredient.fat?.toString() ?? "",
    sugar: ingredient.sugar?.toString() ?? "",
    fiber: ingredient.fiber?.toString() ?? "",
    sodium: ingredient.sodium?.toString() ?? "",
    source: ingredient.source ? [ingredient.source] : [],
    source_ref_id: ingredient.source_ref_id ?? "",
    source_description: ingredient.source_description ?? "",
    match_type: ingredient.match_type ? [ingredient.match_type] : [],
    verification_status: ingredient.verification_status ? [ingredient.verification_status] : [],
    grams_per_ml: ingredient.grams_per_ml?.toString() ?? "",
    grams_per_piece: ingredient.grams_per_piece?.toString() ?? "",
    piece_label: ingredient.piece_label ?? "",
  };
}

// Create-mode starting point — a brand-new row, optionally prefilled from
// an AI estimate. source/price_source/verification_status default to the
// same "manual, needs review" tagging every hand-added ingredient in this
// project gets, never presented as pre-verified.
function draftFormState(draft: Partial<IngredientRow> & { canonical_name: string }): FormState {
  return {
    canonical_name: draft.canonical_name,
    display_name: draft.display_name ?? "",
    aliases: (draft.aliases ?? []).join(", "),
    category: draft.category ?? "",
    food_group: draft.food_group ?? "",
    role: draft.role ? [draft.role] : ["main"],
    state: draft.state ? [draft.state] : [],
    estimated_price: draft.estimated_price?.toString() ?? "",
    estimated_price_unit: draft.estimated_price_unit ?? "",
    price_source: [draft.price_source ?? "manual"],
    basis_amount: draft.basis_amount?.toString() ?? "100",
    basis_unit: draft.basis_unit ?? "g",
    calories: draft.calories?.toString() ?? "",
    protein: draft.protein?.toString() ?? "",
    carbohydrates: draft.carbohydrates?.toString() ?? "",
    fat: draft.fat?.toString() ?? "",
    sugar: draft.sugar?.toString() ?? "",
    fiber: draft.fiber?.toString() ?? "",
    sodium: draft.sodium?.toString() ?? "",
    source: [draft.source ?? "manual"],
    source_ref_id: draft.source_ref_id ?? "",
    source_description: draft.source_description ?? "",
    match_type: draft.match_type ? [draft.match_type] : [],
    verification_status: [draft.verification_status ?? "NEEDS_REVIEW"],
    grams_per_ml: draft.grams_per_ml?.toString() ?? "",
    grams_per_piece: draft.grams_per_piece?.toString() ?? "",
    piece_label: draft.piece_label ?? "",
  };
}

function numOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function textOrNull(value: string): string | null {
  return value.trim() === "" ? null : value.trim();
}

function buildPatch(form: FormState): Partial<IngredientRow> {
  return {
    canonical_name: form.canonical_name.trim(),
    display_name: textOrNull(form.display_name),
    aliases: form.aliases
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean),
    category: textOrNull(form.category),
    food_group: textOrNull(form.food_group),
    role: form.role[0] ?? null,
    state: form.state[0] ?? null,
    estimated_price: numOrNull(form.estimated_price),
    estimated_price_unit: textOrNull(form.estimated_price_unit),
    price_source: form.price_source[0] ?? "manual",
    basis_amount: numOrNull(form.basis_amount) ?? 100,
    basis_unit: textOrNull(form.basis_unit) ?? "g",
    calories: numOrNull(form.calories),
    protein: numOrNull(form.protein),
    carbohydrates: numOrNull(form.carbohydrates),
    fat: numOrNull(form.fat),
    sugar: numOrNull(form.sugar),
    fiber: numOrNull(form.fiber),
    sodium: numOrNull(form.sodium),
    source: form.source[0] ?? null,
    source_ref_id: textOrNull(form.source_ref_id),
    source_description: textOrNull(form.source_description),
    match_type: form.match_type[0] ?? null,
    verification_status: form.verification_status[0] ?? "UNRESOLVED",
    grams_per_ml: numOrNull(form.grams_per_ml),
    grams_per_piece: numOrNull(form.grams_per_piece),
    piece_label: textOrNull(form.piece_label),
  };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3 mb-6">
      <AppText variant="bodyBold">{title}</AppText>
      {children}
    </View>
  );
}

function NumberField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <TextField label={label} value={value} onChangeText={onChangeText} keyboardType="numeric" />
  );
}

export function IngredientEditSheet({
  visible,
  onClose,
  ingredient,
  initialDraft,
  onSave,
  isSaving,
  saveLabel,
  onClosed,
}: Props) {
  const [form, setForm] = useState<FormState | null>(null);
  const [usdaResult, setUsdaResult] = useState<UsdaGroundingResult | null>(null);
  const [usdaCandidateIndex, setUsdaCandidateIndex] = useState(0);
  const [isFetchingUsda, setIsFetchingUsda] = useState(false);

  useEffect(() => {
    if (ingredient) setForm(toFormState(ingredient));
    else if (initialDraft) setForm(draftFormState(initialDraft));
    else setForm(null);
    setUsdaResult(null);
    // Re-derive only when the sheet is opened for a genuinely different
    // target, not on every initialDraft object identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredient, visible]);

  if (!form) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const setMany = (patch: Partial<FormState>) =>
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));

  const handleSave = () => {
    onSave(buildPatch(form));
  };

  // Re-searches using the CURRENT form name (not the original DB value), so
  // fixing a typo in Name and re-fetching reflects the correction. Populates
  // the form only — still requires pressing Save to persist, same as any
  // other field edit here.
  const handleFetchUsda = async () => {
    if (!ingredient) return;
    setIsFetchingUsda(true);
    setUsdaResult(null);
    try {
      const [result] = await groundIngredientsUsda([
        { id: ingredient.id, canonicalName: form.canonical_name },
      ]);
      setUsdaResult(result ?? null);
      setUsdaCandidateIndex(0);
      // So the batch grounding panel doesn't re-surface this ingredient as
      // "never checked" after a deliberate one-off re-run here.
      markUsdaGroundingAttempted([ingredient.id]).catch(() => {});
    } finally {
      setIsFetchingUsda(false);
    }
  };

  const handleApplyUsdaCandidate = () => {
    if (!usdaResult || usdaResult.confidence === "NONE" || usdaResult.confidence === "ERROR") return;
    const candidate = usdaResult.candidates[usdaCandidateIndex] ?? usdaResult.candidates[0];
    const patch = applyUsdaMatch(candidate, usdaResult.confidence);
    setMany({
      calories: patch.calories?.toString() ?? "",
      protein: patch.protein?.toString() ?? "",
      carbohydrates: patch.carbohydrates?.toString() ?? "",
      fat: patch.fat?.toString() ?? "",
      sugar: patch.sugar?.toString() ?? "",
      fiber: patch.fiber?.toString() ?? "",
      sodium: patch.sodium?.toString() ?? "",
      source: patch.source ? [patch.source] : [],
      source_ref_id: patch.source_ref_id ?? "",
      source_description: patch.source_description ?? "",
      match_type: patch.match_type ? [patch.match_type] : [],
      verification_status: patch.verification_status ? [patch.verification_status] : [],
    });
    setUsdaResult(null);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} onClosed={onClosed} heightPercent={0.9}>
      <ScrollView className="flex-1 px-8 pt-16" contentContainerStyle={{ paddingBottom: 24 }}>
        <AppText variant="heading" className="mb-6">
          {ingredient ? "Edit Ingredient" : "Add Ingredient"}
        </AppText>

        <Section title="Identity">
          <TextField label="Name" value={form.canonical_name} onChangeText={(v) => set("canonical_name", v)} />
          <TextField label="Specification (optional)" value={form.display_name} onChangeText={(v) => set("display_name", v)} />
          <TextField
            label="Aliases (comma-separated)"
            value={form.aliases}
            onChangeText={(v) => set("aliases", v)}
          />
        </Section>

        <Section title="Classification">
          <TextField label="Category" value={form.category} onChangeText={(v) => set("category", v)} />
          <TextField label="Food group" value={form.food_group} onChangeText={(v) => set("food_group", v)} />
          <AppText variant="caption">Role</AppText>
          <ChipSelect mode="single" options={ROLE_OPTIONS} value={form.role} onChange={(v) => set("role", v)} />
          <AppText variant="caption">State</AppText>
          <ChipSelect mode="single" options={STATE_OPTIONS} value={form.state} onChange={(v) => set("state", v)} />
        </Section>

        <Section title="Price">
          <NumberField label="Estimated price" value={form.estimated_price} onChangeText={(v) => set("estimated_price", v)} />
          <TextField
            label="Price unit (e.g. kg, L, piece, pack)"
            value={form.estimated_price_unit}
            onChangeText={(v) => set("estimated_price_unit", v)}
          />
          <AppText variant="caption">Price source</AppText>
          <ChipSelect
            mode="single"
            required
            options={PRICE_SOURCE_OPTIONS}
            value={form.price_source}
            onChange={(v) => set("price_source", v)}
          />
        </Section>

        <Section title="Nutrition basis">
          <NumberField label="Basis amount" value={form.basis_amount} onChangeText={(v) => set("basis_amount", v)} />
          <TextField label="Basis unit" value={form.basis_unit} onChangeText={(v) => set("basis_unit", v)} />
        </Section>

        <Section title="Macros">
          <NumberField label="Calories" value={form.calories} onChangeText={(v) => set("calories", v)} />
          <NumberField label="Protein (g)" value={form.protein} onChangeText={(v) => set("protein", v)} />
          <NumberField label="Carbohydrates (g)" value={form.carbohydrates} onChangeText={(v) => set("carbohydrates", v)} />
          <NumberField label="Fat (g)" value={form.fat} onChangeText={(v) => set("fat", v)} />
          <NumberField label="Sugar (g)" value={form.sugar} onChangeText={(v) => set("sugar", v)} />
          <NumberField label="Fiber (g)" value={form.fiber} onChangeText={(v) => set("fiber", v)} />
          <NumberField label="Sodium (mg)" value={form.sodium} onChangeText={(v) => set("sodium", v)} />
        </Section>

        <Section title="Grounding / source">
          <Button
            label={isFetchingUsda ? "Fetching..." : "Fetch from USDA"}
            variant="outline"
            disabled={isFetchingUsda}
            onPress={handleFetchUsda}
          />

          {usdaResult && (
            <View className="gap-2 rounded-2xl border border-ink-emphasis/10 p-3">
              {usdaResult.confidence === "NONE" && (
                <AppText variant="caption" className="text-ink-subtle">
                  No confident USDA match found.
                </AppText>
              )}
              {usdaResult.confidence === "ERROR" && (
                <AppText variant="caption" className="text-like">
                  {usdaResult.error}
                </AppText>
              )}
              {(usdaResult.confidence === "HIGH" || usdaResult.confidence === "LOW") && (
                <>
                  <AppText
                    variant="caption"
                    className={usdaResult.confidence === "HIGH" ? "text-primary" : "text-accent"}
                  >
                    {usdaResult.confidence} confidence
                  </AppText>
                  <View className="flex-row flex-wrap gap-2">
                    {usdaResult.candidates.map((c, i) => (
                      <Pressable
                        key={c.fdcId}
                        onPress={() => setUsdaCandidateIndex(i)}
                        className={`rounded-full px-3 py-1 border ${
                          i === usdaCandidateIndex ? "border-primary bg-primary/10" : "border-ink-emphasis/10"
                        }`}
                      >
                        <AppText
                          variant="caption"
                          className={i === usdaCandidateIndex ? "text-primary" : "text-ink-subtle"}
                        >
                          {c.description} ({c.calories ?? "?"} cal/100g)
                        </AppText>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable
                    onPress={() =>
                      Linking.openURL(
                        getUsdaSourceUrl(usdaResult.candidates[usdaCandidateIndex]?.fdcId ?? usdaResult.candidates[0].fdcId),
                      )
                    }
                    className="flex-row items-center gap-1"
                  >
                    <AppText variant="caption" className="text-primary">
                      View on USDA
                    </AppText>
                    <ExternalLink color={colors.primary} size={12} />
                  </Pressable>
                  <Button label="Apply to form" onPress={handleApplyUsdaCandidate} />
                </>
              )}
            </View>
          )}

          <AppText variant="caption">Source</AppText>
          <ChipSelect mode="single" options={SOURCE_OPTIONS} value={form.source} onChange={(v) => set("source", v)} />
          <TextField label="Source reference ID" value={form.source_ref_id} onChangeText={(v) => set("source_ref_id", v)} />
          {form.source[0] === "USDA" && form.source_ref_id.trim() !== "" && (
            <Pressable
              onPress={() => Linking.openURL(getUsdaSourceUrl(form.source_ref_id.trim()))}
              className="flex-row items-center gap-1 -mt-2"
            >
              <AppText variant="caption" className="text-primary">
                View on USDA
              </AppText>
              <ExternalLink color={colors.primary} size={12} />
            </Pressable>
          )}
          <TextField
            label="Source description"
            value={form.source_description}
            onChangeText={(v) => set("source_description", v)}
          />
          <AppText variant="caption">Match type</AppText>
          <ChipSelect
            mode="single"
            options={MATCH_TYPE_OPTIONS}
            value={form.match_type}
            onChange={(v) => set("match_type", v)}
          />
          <AppText variant="caption">Verification status</AppText>
          <ChipSelect
            mode="single"
            required
            options={VERIFICATION_STATUS_OPTIONS}
            value={form.verification_status}
            onChange={(v) => set("verification_status", v)}
          />
        </Section>

        <Section title="Unit conversion">
          <NumberField label="Grams per mL" value={form.grams_per_ml} onChangeText={(v) => set("grams_per_ml", v)} />
          <NumberField label="Grams per piece" value={form.grams_per_piece} onChangeText={(v) => set("grams_per_piece", v)} />
          <TextField label="Piece label (e.g. clove, medium egg)" value={form.piece_label} onChangeText={(v) => set("piece_label", v)} />
        </Section>

        <Button label={isSaving ? "Saving..." : (saveLabel ?? "Save")} disabled={isSaving} onPress={handleSave} />
      </ScrollView>
    </BottomSheet>
  );
}
