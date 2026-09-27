import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { View, Pressable, ActivityIndicator } from "react-native";
import { CheckCircle2, AlertTriangle, Sparkles } from "lucide-react-native";
import { AppText, Button, NoticeBanner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { updateIngredient, type IngredientRow } from "@/api/ingredients";
import {
  computeItemTotals,
  convertQuantityToBasis,
  countsTowardMealTotals,
  isMealVerifyFieldAllowedForSource,
  parseMealVerifyFixValue,
  verifyMealIngredients,
  type MealVerifyIssue,
  type MealVerifyResult,
  type ProposedTotals,
} from "@/api/meals";
import type { PendingMealIngredient } from "./SeedMealIngredientsEditor";

// Runs AFTER the admin has manually linked/bridged every ingredient below
// (SeedMealIngredientsEditor above this panel is untouched by this — every
// match/bridge trigger there stays 100% admin-initiated). This audits the
// RESULT: total macros/price, each ingredient's computed contribution, and
// whether its bridge/price-unit/state actually hold up — the same review
// this project's own ingredient batches have gotten by hand, run
// automatically instead. A suggested fix is never applied on its own; the
// admin accepts or skips each issue individually, and only an accepted fix
// is written to the ingredients table (verifyMealIngredients never writes
// anything itself).
//
// Deliberately scoped to fixing a FIELD on the already-linked ingredient —
// never a suggestion to re-link to a different ingredient or create a new
// one. That kind of call stays with the admin in the manual review that
// follows this panel.

type IssueState = "pending" | "applying" | "applied" | "skipped" | "error";

type Props = {
  mealName: string;
  mealDescription: string;
  servingSize: number;
  category: string | null;
  items: PendingMealIngredient[]; // already filtered to resolved, non-blank rows
  allIngredients: IngredientRow[];
  onVerified: () => void;
};

export function MealVerifyPanel({ mealName, mealDescription, servingSize, category, items, allIngredients, onVerified }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MealVerifyResult | null>(null);
  const [issueStates, setIssueStates] = useState<Record<number, IssueState>>({});
  const [issueErrors, setIssueErrors] = useState<Record<number, string>>({});
  const queryClient = useQueryClient();

  // Every item here is already linked (ingredientId set) by the time this
  // panel renders — SeedMealScreen only mounts it once allResolved is true.
  // But "linked" alone isn't enough to actually verify: it also needs a
  // working quantity conversion, and (briefly) the just-linked ingredient
  // has to actually be present in `allIngredients` — a freshly created or
  // just-relinked ingredient can be missing from that cached list for one
  // render until its query invalidation refetches. Splitting into
  // resolved/blocked (with a reason) rather than a single boolean means the
  // panel can say WHY it's disabled instead of a blanket "link everything"
  // message that's wrong whenever every row already shows "Linked ✓".
  //
  // A THIRD bucket exists implicitly: an ingredient with no quantity set at
  // all (e.g. "to taste") is neither resolved nor blocked — it's silently
  // excluded from both, same as recomputeMealTotals already treats it.
  // Requiring a quantity just to unlock Verify would force a fake number
  // onto something that's deliberately unquantified.
  const { resolvedInputs, blocked } = useMemo(() => {
    const resolved: {
      displayText: string;
      quantityAmount: number;
      quantityUnit: string;
      ingredient: IngredientRow;
      computed: ProposedTotals;
    }[] = [];
    const blockedItems: { name: string; reason: string }[] = [];

    for (const item of items) {
      const ingredient = allIngredients.find((i) => i.id === item.ingredientId);
      if (!ingredient) {
        blockedItems.push({ name: item.name, reason: "still syncing after linking — try again in a moment" });
        continue;
      }
      if (item.quantityAmount.trim() === "") {
        // No quantity set at all (e.g. "to taste") — recomputeMealTotals
        // already treats this as "doesn't count," not an error, so Verify
        // shouldn't require it either. Just skip it silently: it doesn't
        // block the rest of the meal from being verified, and there's
        // nothing computed to audit for it anyway.
        continue;
      }
      const amount = Number(item.quantityAmount);
      if (Number.isNaN(amount)) {
        blockedItems.push({ name: item.name, reason: "quantity isn't a valid number" });
        continue;
      }
      const conversion = convertQuantityToBasis(amount, item.quantityUnit, ingredient);
      if (!conversion.ok) {
        blockedItems.push({ name: item.name, reason: conversion.reason });
        continue;
      }
      const priceAmount = item.priceQuantityAmount.trim() !== "" ? Number(item.priceQuantityAmount) : null;
      const computed = computeItemTotals(
        ingredient,
        amount,
        item.quantityUnit,
        priceAmount != null && !Number.isNaN(priceAmount) ? priceAmount : null,
        item.priceQuantityUnit || null,
      );
      resolved.push({
        displayText: item.displayText.trim() || item.name,
        quantityAmount: amount,
        quantityUnit: item.quantityUnit,
        ingredient,
        computed,
      });
    }

    return { resolvedInputs: resolved, blocked: blockedItems };
  }, [items, allIngredients]);

  const totals: ProposedTotals = resolvedInputs.reduce(
    (acc, item) => {
      if (!countsTowardMealTotals(item.ingredient)) return acc;
      return {
        calories: (acc.calories ?? 0) + (item.computed.calories ?? 0),
        protein: (acc.protein ?? 0) + (item.computed.protein ?? 0),
        carbohydrates: (acc.carbohydrates ?? 0) + (item.computed.carbohydrates ?? 0),
        fat: (acc.fat ?? 0) + (item.computed.fat ?? 0),
        price: (acc.price ?? 0) + (item.computed.price ?? 0),
      };
    },
    { calories: 0, protein: 0, carbohydrates: 0, fat: 0, price: 0 } as ProposedTotals,
  );

  const canVerify = resolvedInputs.length > 0 && blocked.length === 0;

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      const verification = await verifyMealIngredients(
        { name: mealName, description: mealDescription || null, servingSize, category },
        resolvedInputs,
        totals,
      );
      // Defense in depth against the SOURCE rule in the verify prompt —
      // a USDA-sourced ingredient's nutrition/state is never a valid fix
      // target, so drop any issue like that here rather than show a
      // suggestion that could never actually be applied.
      const allowedIssues = verification.issues.filter((issue) => {
        const ingredient = allIngredients.find((i) => i.canonical_name === issue.ingredientName);
        return isMealVerifyFieldAllowedForSource(issue.field, ingredient?.source ?? null);
      });
      setResult({ ...verification, issues: allowedIssues });
      setIssueStates({});
      setIssueErrors({});
      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // A price-unit fix must never be applied without its paired price-value
  // fix, or vice versa — applying only one half would leave the ingredient
  // priced in a unit the number was never meant for (see verify-meal-
  // ingredients's check 3: a genuine cross-domain unit correction always
  // comes with a freshly-estimated price for the new unit). If the result
  // flagged both for the same ingredient, find the other half.
  const findPairedIndex = (index: number, issue: MealVerifyIssue): number | null => {
    if (!result) return null;
    const pairedField: MealVerifyIssue["field"] | null =
      issue.field === "estimated_price" ? "estimated_price_unit" : issue.field === "estimated_price_unit" ? "estimated_price" : null;
    if (!pairedField) return null;
    const i = result.issues.findIndex(
      (other, otherIndex) => otherIndex !== index && other.ingredientName === issue.ingredientName && other.field === pairedField,
    );
    return i >= 0 ? i : null;
  };

  const handleApply = async (index: number, issue: MealVerifyIssue) => {
    const ingredient = allIngredients.find((i) => i.canonical_name === issue.ingredientName);
    if (!ingredient) {
      setIssueErrors((prev) => ({ ...prev, [index]: "Couldn't find this ingredient anymore — try re-verifying." }));
      return;
    }
    if (!isMealVerifyFieldAllowedForSource(issue.field, ingredient.source)) {
      setIssueErrors((prev) => ({ ...prev, [index]: "Can't overwrite verified USDA nutrition data." }));
      setIssueStates((prev) => ({ ...prev, [index]: "error" }));
      return;
    }

    const pairedIndex = findPairedIndex(index, issue);
    const pairedIssue = pairedIndex != null ? result?.issues[pairedIndex] : undefined;
    const indexes = pairedIndex != null ? [index, pairedIndex] : [index];

    setIssueStates((prev) => {
      const next = { ...prev };
      for (const i of indexes) next[i] = "applying";
      return next;
    });
    try {
      const patch = {
        ...parseMealVerifyFixValue(issue.field, issue.suggestedValue),
        ...(pairedIssue ? parseMealVerifyFixValue(pairedIssue.field, pairedIssue.suggestedValue) : {}),
      };
      await updateIngredient(ingredient.id, patch);
      await queryClient.invalidateQueries({ queryKey: ["admin", "meals"] });
      setIssueStates((prev) => {
        const next = { ...prev };
        for (const i of indexes) next[i] = "applied";
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setIssueStates((prev) => {
        const next = { ...prev };
        for (const i of indexes) next[i] = "error";
        return next;
      });
      setIssueErrors((prev) => {
        const next = { ...prev };
        for (const i of indexes) next[i] = message;
        return next;
      });
    }
  };

  const handleSkip = (index: number) => {
    setIssueStates((prev) => ({ ...prev, [index]: "skipped" }));
  };

  return (
    <View className="gap-3 mb-6">
      <AppText variant="bodyBold">Verify</AppText>
      <AppText variant="caption" className="text-ink-subtle -mt-2">
        Once every ingredient above is linked, run an AI check on the totals, individual macros/price, and bridges —
        catches things like a canned ingredient linked to its raw variant, or a bridge value that looks off. Nothing
        is changed unless you accept a suggestion below.
      </AppText>

      {!canVerify && blocked.length > 0 && (
        <View className="gap-0.5">
          {blocked.map((b, i) => (
            <AppText key={i} variant="caption" className="text-like">
              {b.name || "This ingredient"}: {b.reason}
            </AppText>
          ))}
        </View>
      )}
      {!canVerify && blocked.length === 0 && (
        <AppText variant="caption" className="text-like">
          Nothing to verify yet — every ingredient is set to "to taste" or has no quantity.
        </AppText>
      )}

      <Button
        label={loading ? "Verifying..." : result ? "Re-verify" : "Verify with AI"}
        variant="outline"
        icon={<Sparkles color={colors.primary} size={16} />}
        disabled={!canVerify || loading}
        onPress={handleVerify}
      />

      {error && (
        <AppText variant="caption" className="text-like">
          {error}
        </AppText>
      )}

      {result && (
        <View className="gap-3">
          <NoticeBanner
            tone={result.overallAssessment === "plausible" ? "positive" : "notice"}
            icon={
              result.overallAssessment === "plausible" ? (
                <CheckCircle2 color={colors.primary} size={18} />
              ) : (
                <AlertTriangle color={colors.notice.icon} size={18} />
              )
            }
          >
            <AppText variant="bodyBold" className={result.overallAssessment === "plausible" ? "text-primary" : "text-notice-text"}>
              {result.overallAssessment === "plausible" ? "Looks plausible" : "Worth a second look"}
            </AppText>
            {!!result.summary && (
              <AppText variant="caption" className={result.overallAssessment === "plausible" ? "text-primary" : "text-notice-text"}>
                {result.summary}
              </AppText>
            )}
          </NoticeBanner>

          {result.issues.map((issue, index) => {
            const state = issueStates[index] ?? "pending";
            // Shown on every issue so it's obvious at a glance which
            // validation mode applied — USDA ingredients only ever get
            // price/bridge suggestions here (see isMealVerifyFieldAllowedForSource),
            // never a nutrition fix, so this is a visible confirmation of
            // that rule, not just an internal guard.
            const ingredientSource = allIngredients.find((i) => i.canonical_name === issue.ingredientName)?.source ?? null;
            const isUsda = ingredientSource === "USDA";
            return (
              <View key={index} className="gap-1.5 rounded-2xl border border-notice-border bg-notice-bg p-3">
                <View className="flex-row items-center flex-wrap gap-1.5">
                  <AppText variant="bodyBold" className="text-notice-text">
                    {issue.ingredientName} · {issue.field}
                  </AppText>
                  <View className={`rounded-full px-2 py-0.5 ${isUsda ? "bg-primary/15" : "bg-ink-emphasis/10"}`}>
                    <AppText variant="caption" className={isUsda ? "text-primary" : "text-ink-subtle"}>
                      {isUsda ? "USDA" : "Manual"}
                    </AppText>
                  </View>
                </View>
                <AppText variant="caption" className="text-notice-text">
                  {issue.issue}
                </AppText>
                <AppText variant="caption" className="text-ink-subtle">
                  Currently {issue.currentValue} → suggest {issue.suggestedValue}
                </AppText>
                <AppText variant="caption" className="text-ink-subtle">
                  {issue.reasoning}
                </AppText>
                {findPairedIndex(index, issue) != null && (
                  <AppText variant="caption" className="text-ink-subtle italic">
                    Applies together with this ingredient's other price fix below.
                  </AppText>
                )}

                {state === "pending" && (
                  <View className="flex-row gap-4 mt-1">
                    <Pressable onPress={() => handleApply(index, issue)}>
                      <AppText variant="caption" className="text-primary">
                        Accept fix
                      </AppText>
                    </Pressable>
                    <Pressable onPress={() => handleSkip(index)}>
                      <AppText variant="caption" className="text-ink-subtle">
                        Skip
                      </AppText>
                    </Pressable>
                  </View>
                )}
                {state === "applying" && (
                  <View className="flex-row items-center gap-2 mt-1">
                    <ActivityIndicator size="small" color={colors.primary} />
                    <AppText variant="caption" className="text-ink-subtle">
                      Applying...
                    </AppText>
                  </View>
                )}
                {state === "applied" && (
                  <AppText variant="caption" className="text-primary mt-1">
                    Applied — the ingredient record was updated.
                  </AppText>
                )}
                {state === "skipped" && (
                  <AppText variant="caption" className="text-ink-subtle mt-1">
                    Skipped
                  </AppText>
                )}
                {state === "error" && (
                  <AppText variant="caption" className="text-like mt-1">
                    {issueErrors[index] ?? "Couldn't apply this fix."}
                  </AppText>
                )}
              </View>
            );
          })}

          {result.issues.length === 0 && (
            <AppText variant="caption" className="text-ink-subtle">
              No issues flagged.
            </AppText>
          )}
        </View>
      )}
    </View>
  );
}
