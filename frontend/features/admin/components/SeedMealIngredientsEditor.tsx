import { useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Trash2, Check, ChevronDown } from "lucide-react-native";
import { AppText, Button, Dropdown, TextField } from "@/frontend/components/ui";
import type { DropdownItem } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import {
  applyUsdaMatch,
  classifyUsdaConfidence,
  createIngredient,
  estimateIngredientAi,
  estimateIngredientGaps,
  groundIngredientsUsda,
  updateIngredient,
  type AiIngredientEstimate,
  type IngredientRow,
  type UsdaGroundingMatch,
} from "@/api/ingredients";
import { matchIngredientCandidates, type QuantityUnit } from "@/api/meals";
import { IngredientEditSheet } from "./IngredientEditSheet";
import { ConfirmIngredientSheet } from "./ConfirmIngredientSheet";

export type { QuantityUnit };

export type PendingMealIngredient = {
  key: string;
  name: string;
  quantityAmount: string;
  quantityUnit: QuantityUnit;
  displayText: string;
  ingredientId: string | null;
  ingredientName: string | null; // for display once resolved, without refetching
};

const UNIT_OPTIONS: { id: QuantityUnit; label: string }[] = [
  { id: "g", label: "g" },
  { id: "kg", label: "kg" },
  { id: "ml", label: "ml" },
  { id: "L", label: "L" },
  { id: "piece", label: "piece" },
];

let counter = 0;
export function newPendingIngredient(): PendingMealIngredient {
  counter += 1;
  return {
    key: `pending-${Date.now()}-${counter}`,
    name: "",
    quantityAmount: "",
    quantityUnit: "g",
    displayText: "",
    ingredientId: null,
    ingredientName: null,
  };
}

export function resolvePendingIngredient(
  items: PendingMealIngredient[],
  key: string,
  ingredient: IngredientRow,
): PendingMealIngredient[] {
  return items.map((item) =>
    item.key === key
      ? {
          ...item,
          ingredientId: ingredient.id,
          ingredientName: ingredient.canonical_name,
          displayText: item.displayText.trim() || `${item.quantityAmount} ${item.quantityUnit}`,
        }
      : item,
  );
}

// Mirrors TextField's floating-label layout (small label above the value,
// both inside the same bordered box) so a select reads as the same kind of
// field, not a different control — just statically in the "filled" state
// since a select always has a current value, no empty/focus transition to
// animate between.
function SelectField({ label, valueLabel, loading }: { label: string; valueLabel: string; loading?: boolean }) {
  return (
    <View
      className="flex-row items-center justify-between px-4"
      style={{ borderRadius: 16, borderWidth: 1, height: 55, borderColor: "rgba(43, 52, 55, 0.1)" }}
    >
      <View className="flex-1 justify-center" style={{ height: 44 }}>
        <Text className="font-inter-medium text-caption text-ink-subtle">{label}</Text>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          className="font-inter-semibold text-subheading text-ink-emphasis"
        >
          {valueLabel}
        </Text>
      </View>
      {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <ChevronDown color={colors.ink.subtle} size={16} />}
    </View>
  );
}

type UsdaSearchState = { loading: boolean; candidates: UsdaGroundingMatch[] | null; error: string | null };

// Edge Function calls occasionally fail at the network layer on mobile
// (a dropped WiFi/cellular hop, not an error the function itself
// returned) — surfaces as supabase-js's generic "Failed to send a
// request to Edge Function" with no real diagnostic value. One silent
// retry absorbs that class of transient blip before bothering the admin
// with an error for what's usually just a flaky connection.
async function withOneRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return await fn();
  }
}

function IngredientRowCard({
  item,
  allIngredients,
  onChange,
  onRemove,
  onResolve,
}: {
  item: PendingMealIngredient;
  allIngredients: IngredientRow[];
  onChange: (patch: Partial<PendingMealIngredient>) => void;
  onRemove: () => void;
  onResolve: (ingredient: IngredientRow) => void;
}) {
  const [usdaSearch, setUsdaSearch] = useState<UsdaSearchState | null>(null);
  const [creating, setCreating] = useState(false);
  const [aiEstimating, setAiEstimating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<AiIngredientEstimate | null>(null);
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [confirmPatch, setConfirmPatch] = useState<(Partial<IngredientRow> & { canonical_name: string }) | null>(null);
  // Two RN Modals presented at once (even briefly, mid-transition) can leave
  // an orphaned full-screen overlay that blocks all touches underneath — so
  // the edit sheet and confirm sheet are never both visible together. These
  // hold the handoff data until the sheet being closed actually finishes
  // its close animation (BottomSheet's onClosed), not just the instant its
  // `visible` prop flips.
  const [pendingConfirmPatch, setPendingConfirmPatch] = useState<(Partial<IngredientRow> & { canonical_name: string }) | null>(null);
  const [pendingReopenEdit, setPendingReopenEdit] = useState(false);
  const [confirmSaving, setConfirmSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const candidates = useMemo(
    () => (item.name.trim() ? matchIngredientCandidates(item.name, allIngredients) : []),
    [item.name, allIngredients],
  );

  const unitItems: DropdownItem[] = UNIT_OPTIONS.map((opt) => ({
    label: opt.label,
    onPress: () => onChange({ quantityUnit: opt.id }),
  }));

  // Per-100g macros of the candidate itself (not scaled to this meal's
  // quantity) — what actually lets an admin sanity-check "is this really
  // the same food", since scaled totals depend on a quantity that might
  // not even be filled in yet.
  const macroPreview = (calories: number | null, protein: number | null, carbohydrates: number | null, fat: number | null) => {
    const parts: string[] = [];
    if (calories != null) parts.push(`${calories.toFixed(0)} cal`);
    if (protein != null) parts.push(`${protein.toFixed(1)}g P`);
    if (carbohydrates != null) parts.push(`${carbohydrates.toFixed(1)}g C`);
    if (fat != null) parts.push(`${fat.toFixed(1)}g F`);
    return parts.length > 0 ? `${parts.join(" · ")} per 100g` : "no macro data";
  };

  // FNRI/USDA/Manual — same vocabulary as IngredientEditSheet's Source
  // field. This is the whole point of searching the local DB first: a
  // match already grounded to a real FNRI/USDA record is trustworthy in a
  // way a "manual" AI-estimated placeholder isn't, and the admin can't
  // tell the difference without this shown.
  const sourceLabel = (source: string | null) => source ?? "unverified";

  // Confidence label instead of a raw score — same HIGH/LOW vocabulary and
  // meaning as the USDA grounding panel/edit sheet, so an admin reading
  // this dropdown doesn't need a second mental scale.
  const candidateItems: DropdownItem[] = candidates.map(({ ingredient, confidence }) => ({
    label: `${ingredient.canonical_name} — ${confidence} confidence · ${sourceLabel(ingredient.source)}\n${macroPreview(ingredient.calories, ingredient.protein, ingredient.carbohydrates, ingredient.fat)}`,
    onPress: () => onResolve(ingredient),
  }));

  // The already-linked ingredient's own source, looked up from the full
  // list rather than stored on PendingMealIngredient — same reasoning as
  // above, so "Linked to X" still shows how trustworthy that link is.
  const linkedIngredient = item.ingredientId ? allIngredients.find((i) => i.id === item.ingredientId) : null;

  const handleSearchUsda = async () => {
    setUsdaSearch({ loading: true, candidates: null, error: null });
    try {
      const [result] = await withOneRetry(() =>
        groundIngredientsUsda([{ id: item.key, canonicalName: item.name }]),
      );
      if (!result || result.confidence === "NONE") {
        setUsdaSearch({ loading: false, candidates: [], error: null });
      } else if (result.confidence === "ERROR") {
        setUsdaSearch({ loading: false, candidates: null, error: result.error });
      } else {
        setUsdaSearch({ loading: false, candidates: result.candidates, error: null });
      }
    } catch (err) {
      setUsdaSearch({ loading: false, candidates: null, error: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleAddAndUse = async (candidate: UsdaGroundingMatch) => {
    setCreating(true);
    setCreateError(null);
    try {
      const patch = applyUsdaMatch(candidate, "HIGH");
      const created = await createIngredient({
        canonical_name: item.name,
        role: "main",
        state: null,
        basis_amount: 100,
        basis_unit: "g",
        price_source: "manual",
        ...patch,
      });
      // USDA gives real nutrition but nothing operational (price, the
      // piece-count bridge) — an LLM fills exactly those gaps so this
      // ingredient never sits with a null price/bridge that silently
      // zeroes it out of a meal's totals. Best-effort: the ingredient is
      // already created and linked either way, just missing gap fields if
      // this fails (fixable later in Manage Ingredients).
      try {
        const gaps = await estimateIngredientGaps(created);
        const filled = await updateIngredient(created.id, gaps);
        onResolve(filled);
      } catch {
        onResolve(created);
      }
      setUsdaSearch(null);
    } catch (err) {
      // Surfaced, not swallowed — an insert can fail (RLS, a constraint)
      // without onResolve ever running, which otherwise looks identical to
      // "nothing happened" with no indication whether it reached the DB.
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  // The admin's own call that nothing found so far (local DB or USDA) is a
  // real match: an LLM estimates a full draft row, the admin reviews/edits
  // every field in the same sheet used to edit real ingredients, then
  // confirms in a read-only summary before anything is written — never
  // auto-applied.
  const handleAiEstimate = async () => {
    setAiEstimating(true);
    setAiError(null);
    try {
      const draft = await withOneRetry(() => estimateIngredientAi(item.name));
      setAiDraft(draft);
      setEditSheetVisible(true);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiEstimating(false);
    }
  };

  const handleConfirmCreate = async () => {
    if (!confirmPatch) return;
    setConfirmSaving(true);
    setCreateError(null);
    try {
      const created = await createIngredient(confirmPatch);
      onResolve(created);
      setConfirmPatch(null);
      setAiDraft(null);
    } catch (err) {
      // Keep the sheet open with the error visible rather than closing on
      // failure — same silent-failure risk as handleAddAndUse above.
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setConfirmSaving(false);
    }
  };

  return (
    <View className="gap-2 rounded-2xl border border-ink-emphasis/10 p-3">
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <TextField label="Ingredient name" value={item.name} onChangeText={(v) => onChange({ name: v })} />
        </View>
        <Pressable onPress={onRemove} className="h-9 w-9 items-center justify-center">
          <Trash2 color={colors.like} size={18} />
        </Pressable>
      </View>

      <View className="flex-row gap-2">
        <View className="flex-1">
          <TextField
            label="Qty amount"
            value={item.quantityAmount}
            onChangeText={(v) => onChange({ quantityAmount: v })}
            keyboardType="numeric"
          />
        </View>
        <View className="flex-1">
          <Dropdown
            trigger={<SelectField label="Unit" valueLabel={item.quantityUnit} />}
            items={unitItems}
            matchTriggerWidth
          />
        </View>
      </View>

      <TextField
        label={'Display text (e.g. "3 cloves", "to taste")'}
        value={item.displayText}
        onChangeText={(v) => onChange({ displayText: v })}
      />

      <Dropdown
        trigger={
          <SelectField
            label="Ingredient database match"
            valueLabel={
              linkedIngredient
                ? `${linkedIngredient.canonical_name} (${sourceLabel(linkedIngredient.source)})`
                : candidates.length > 0
                  ? `${candidates.length} match(es) found`
                  : "No match — try Search USDA below"
            }
          />
        }
        items={candidateItems.length > 0 ? candidateItems : [{ label: "No matches yet", onPress: () => {} }]}
        matchTriggerWidth
      />

      {item.ingredientId ? (
        <View className="flex-row items-center gap-2">
          <Check color={colors.primary} size={14} />
          <AppText variant="caption" className="text-primary">
            Linked to {item.ingredientName}
            {linkedIngredient ? ` (${sourceLabel(linkedIngredient.source)})` : ""}
          </AppText>
        </View>
      ) : (
        <AppText variant="caption" className="text-like">
          Not yet linked to a real ingredient
        </AppText>
      )}

      {createError && (
        <AppText variant="caption" className="text-like">
          Couldn't add ingredient: {createError}
        </AppText>
      )}

      {usdaSearch?.candidates && usdaSearch.candidates.length > 0 ? (
        <Dropdown
          trigger={
            <SelectField
              label="USDA match"
              valueLabel={creating ? "Adding + filling in details..." : `${usdaSearch.candidates.length} result(s) — tap to add + use`}
              loading={creating}
            />
          }
          items={usdaSearch.candidates.map((c) => ({
            label: `${c.description} — ${classifyUsdaConfidence(c.score)} confidence\n${macroPreview(c.calories, c.protein, c.carbohydrates, c.fat)}`,
            onPress: () => handleAddAndUse(c),
          }))}
          matchTriggerWidth
        />
      ) : (
        <Pressable onPress={handleSearchUsda} disabled={usdaSearch?.loading} className="flex-row items-center gap-2">
          {usdaSearch?.loading && <ActivityIndicator size="small" color={colors.primary} />}
          <AppText variant="caption" className="text-primary">
            {usdaSearch?.loading ? "Searching USDA..." : "Search USDA"}
          </AppText>
        </Pressable>
      )}

      {usdaSearch?.error && (
        <AppText variant="caption" className="text-like">
          {usdaSearch.error}
        </AppText>
      )}
      {usdaSearch?.candidates?.length === 0 && (
        <AppText variant="caption" className="text-ink-subtle">
          No USDA match either — try adjusting the name.
        </AppText>
      )}

      {/* Always available, independent of USDA search state — this is the
          admin's own judgment call ("none of these actually match") to
          make at any point, not something gated behind a specific search
          result. */}
      <Pressable onPress={handleAiEstimate} disabled={aiEstimating} className="flex-row items-center gap-2">
        {aiEstimating && <ActivityIndicator size="small" color={colors.primary} />}
        <AppText variant="caption" className="text-primary">
          {aiEstimating ? "Estimating..." : "AI Estimate"}
        </AppText>
      </Pressable>
      {aiError && (
        <AppText variant="caption" className="text-like">
          {aiError}
        </AppText>
      )}

      <IngredientEditSheet
        visible={editSheetVisible}
        onClose={() => setEditSheetVisible(false)}
        ingredient={null}
        initialDraft={aiDraft}
        onSave={(patch) => {
          setCreateError(null);
          setPendingConfirmPatch({ ...patch, canonical_name: patch.canonical_name ?? item.name });
          setEditSheetVisible(false);
        }}
        onClosed={() => {
          if (pendingConfirmPatch) {
            setConfirmPatch(pendingConfirmPatch);
            setPendingConfirmPatch(null);
          }
        }}
        isSaving={false}
        saveLabel="Review"
      />

      <ConfirmIngredientSheet
        visible={!!confirmPatch}
        patch={confirmPatch}
        onCancel={() => {
          setPendingReopenEdit(true);
          setConfirmPatch(null);
        }}
        onClosed={() => {
          if (pendingReopenEdit) {
            setEditSheetVisible(true);
            setPendingReopenEdit(false);
          }
        }}
        onConfirm={handleConfirmCreate}
        isSaving={confirmSaving}
        error={createError}
      />
    </View>
  );
}

type Props = {
  items: PendingMealIngredient[];
  allIngredients: IngredientRow[];
  onChange: (items: PendingMealIngredient[]) => void;
};

export function SeedMealIngredientsEditor({ items, allIngredients, onChange }: Props) {
  const update = (key: string, patch: Partial<PendingMealIngredient>) => {
    onChange(
      items.map((item) =>
        item.key === key
          ? {
              ...item,
              ...patch,
              // Editing the name/qty after a bind invalidates that bind —
              // the resolved ingredient may no longer be the right match.
              ...(patch.name !== undefined || patch.quantityAmount !== undefined || patch.quantityUnit !== undefined
                ? { ingredientId: null, ingredientName: null }
                : {}),
            }
          : item,
      ),
    );
  };

  const resolve = (key: string, ingredient: IngredientRow) => {
    onChange(resolvePendingIngredient(items, key, ingredient));
  };

  const remove = (key: string) => onChange(items.filter((item) => item.key !== key));

  return (
    <View className="gap-4">
      {items.map((item) => (
        <IngredientRowCard
          key={item.key}
          item={item}
          allIngredients={allIngredients}
          onChange={(patch) => update(item.key, patch)}
          onRemove={() => remove(item.key)}
          onResolve={(ingredient) => resolve(item.key, ingredient)}
        />
      ))}

      <Button label="+ Add ingredient" variant="outline" onPress={() => onChange([...items, newPendingIngredient()])} />
    </View>
  );
}
