import { useState } from "react";
import { View, Text } from "react-native";
import { AlertTriangle, ArrowRight, Check, CheckCircle2, Sparkles } from "lucide-react-native";
import { AppText, Button, NoticeBanner, Spinner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { isBridgeLocked, type IngredientRow } from "@/api/ingredients";
import { bridgeFixAsRowQuantity, parseMealBridgeFix, verifyMealIngredients, type MealBridgeIssue } from "@/api/meals";
import { errorMessage } from "@/lib/errorMessage";
import { useConfirmedIngredientUpdate } from "../hooks/useConfirmedIngredientUpdate";
import type { MealCalculation, CalcRow } from "../utils/mealCalculation";
import { ConfirmIngredientUpdateSheet } from "./ConfirmIngredientUpdateSheet";
import type { PendingMealIngredient } from "./SeedMealIngredientsEditor";
import { ActionChip, InlineError, StatTiles, StatusChip } from "./AdminUi";

// Seed Meal's check, below the ingredient list once everything is linked.
// Two layers (see the Seed Meal checks note in api/meals.ts):
// - Calculation check: live, no AI. Shows what every ingredient adds in
//   kcal and ₱ and flags only what's definitely broken. Its errors gate
//   Confirm Seed; an arithmetic-only fix applies in one tap.
// - Bridge check: optional AI pass over piece weights, densities and
//   quantities vs the recipe text. Never macros, never prices.
// Ingredient fixes go through the confirm sheet (other saved meals may use
// the same ingredient); a quantity fix only edits this recipe's row. A
// piece-weight or density suggestion offers "this recipe only" first,
// since the usual cause is this recipe's piece size, not the shared value.
// Verified bridges never get suggestions (see isBridgeLocked).

type FixState = "applying" | "applied" | "skipped" | "error";

type Props = {
  mealName: string;
  servingSize: number;
  calculation: MealCalculation;
  onUpdateItem: (key: string, patch: Partial<PendingMealIngredient>) => void;
};

const SOURCE_CHIP: Record<string, { label: string; tone: "success" | "neutral" }> = {
  USDA: { label: "USDA", tone: "success" },
  FNRI: { label: "FNRI", tone: "success" },
};

const formatAmount = (amount: number) => (amount < 10 ? Math.round(amount * 10) / 10 : Math.round(amount)).toString();
const formatPeso = (price: number) => `₱${price < 10 ? price.toFixed(2) : Math.round(price).toLocaleString()}`;

// The verified bridge this row's math actually goes through, if any.
function verifiedBridgeLabel(row: CalcRow): string | null {
  if (!row.ingredient || !row.quantity) return null;
  const { unit } = row.quantity;
  if (unit === "piece") return isBridgeLocked(row.ingredient, "grams_per_piece") ? "Piece verified" : null;
  const crossesDomain =
    ((unit === "ml" || unit === "L") && row.ingredient.basis_unit === "g") ||
    ((unit === "g" || unit === "kg") && row.ingredient.basis_unit === "ml");
  return crossesDomain && isBridgeLocked(row.ingredient, "grams_per_ml") ? "Density verified" : null;
}

function rowSummary(row: CalcRow): string {
  if (row.notCounted) return `${row.displayText} · not counted`;
  if (!row.used || !row.computed) return row.displayText;
  const parts = [`${row.displayText} → ${formatAmount(row.used.amount)} ${row.used.unit}`];
  if (row.computed.calories != null) parts.push(`${Math.round(row.computed.calories)} kcal`);
  if (row.computed.price != null) parts.push(formatPeso(row.computed.price));
  return parts.join(" · ");
}

export function MealVerifyPanel({ mealName, servingSize, calculation, onUpdateItem }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<MealBridgeIssue[] | null>(null);
  // Keyed "calc:<rowKey>:<i>" for calculation fixes, "ai:<i>" for bridge fixes.
  const [fixStates, setFixStates] = useState<Record<string, FixState>>({});
  const [fixErrors, setFixErrors] = useState<Record<string, string>>({});
  const [pendingFixId, setPendingFixId] = useState<string | null>(null);
  const confirmedUpdate = useConfirmedIngredientUpdate();

  const { rows, totals, errorCount, warningCount } = calculation;
  const countedRows = rows.filter((r) => r.used && r.ingredient);
  const servings = Math.max(servingSize, 1);

  const setFix = (id: string, state: FixState, message?: string) => {
    setFixStates((prev) => ({ ...prev, [id]: state }));
    if (message) setFixErrors((prev) => ({ ...prev, [id]: message }));
  };

  const requestIngredientFix = async (id: string, ingredient: IngredientRow, patch: Partial<IngredientRow>) => {
    setPendingFixId(id);
    setFix(id, "applying");
    await confirmedUpdate.requestUpdate([{ id: ingredient.id, patch, name: ingredient.canonical_name }]);
  };

  const handleConfirmFix = async () => {
    if (!pendingFixId) return;
    const id = pendingFixId;
    try {
      // The confirm hook (not a raw updateIngredient) so every other meal
      // built on this ingredient is recomputed too.
      await confirmedUpdate.confirm();
      setFix(id, "applied");
    } catch (err) {
      confirmedUpdate.cancel();
      setFix(id, "error", errorMessage(err));
    } finally {
      setPendingFixId(null);
    }
  };

  const handleCancelFix = () => {
    if (pendingFixId) {
      const id = pendingFixId;
      setFixStates((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    confirmedUpdate.cancel();
    setPendingFixId(null);
  };

  const handleBridgeCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await verifyMealIngredients(
        { name: mealName, servingSize: servings },
        countedRows.flatMap((row) =>
          row.ingredient && row.quantity && row.used
            ? [
                {
                  key: row.key,
                  displayText: row.displayText,
                  quantityAmount: row.quantity.amount,
                  quantityUnit: row.quantity.unit,
                  ingredient: row.ingredient,
                  usedAmount: row.used.amount,
                  usedUnit: row.used.unit,
                },
              ]
            : [],
        ),
      );
      setIssues(result);
      setFixStates((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !id.startsWith("ai:"))));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleApplyBridgeFix = async (index: number, issue: MealBridgeIssue) => {
    const id = `ai:${index}`;
    const parsed = parseMealBridgeFix(issue.field, issue.suggestedValue);
    if (!parsed.ok) {
      setFix(id, "error", parsed.reason);
      return;
    }
    if (parsed.target === "row") {
      onUpdateItem(issue.key, { quantityAmount: parsed.quantityAmount, quantityUnit: parsed.quantityUnit });
      setFix(id, "applied");
      return;
    }
    const ingredient = rows.find((r) => r.key === issue.key)?.ingredient;
    if (!ingredient) {
      setFix(id, "error", "Couldn't find this ingredient anymore. Run the check again.");
      return;
    }
    await requestIngredientFix(id, ingredient, parsed.patch);
  };

  const handleApplyToRow = (index: number, issue: MealBridgeIssue, quantity: { quantityAmount: string; quantityUnit: PendingMealIngredient["quantityUnit"] }) => {
    onUpdateItem(issue.key, quantity);
    setFix(`ai:${index}`, "applied");
  };

  const fixStatus = (id: string) => {
    const state = fixStates[id];
    if (state === "applying") {
      return (
        <View className="flex-row items-center gap-2">
          <Spinner variant="wave" size={12} color={colors.accent} />
          <Text className="font-inter-regular text-body text-ink-subtle">Applying...</Text>
        </View>
      );
    }
    if (state === "applied") return <StatusChip label="Applied" tone="success" />;
    if (state === "skipped") return <StatusChip label="Skipped" />;
    if (state === "error") return <InlineError>{fixErrors[id] ?? "Couldn't apply this fix."}</InlineError>;
    return null;
  };

  const summary =
    errorCount > 0
      ? { tone: "notice" as const, title: `${errorCount} to fix before saving`, detail: warningCount > 0 ? `Plus ${warningCount} worth a look.` : null }
      : warningCount > 0
        ? { tone: "notice" as const, title: `${warningCount} worth a look`, detail: "Nothing blocks saving." }
        : { tone: "positive" as const, title: `All ${countedRows.length} counted ingredients calculate correctly`, detail: null };

  return (
    <View className="mb-6 gap-4 rounded-2xl border border-ink-emphasis/10 p-5">
      <View className="gap-1">
        <AppText variant="sectionSubtitle" dot>
          Check
        </AppText>
        <AppText variant="caption" className="text-ink-subtle">
          Updates as you edit. Only flags what breaks this meal's calories or price.
        </AppText>
      </View>

      <NoticeBanner
        tone={summary.tone}
        icon={
          summary.tone === "positive" ? (
            <CheckCircle2 color={colors.primary} size={18} />
          ) : (
            <AlertTriangle color={colors.notice.icon} size={18} />
          )
        }
      >
        <AppText variant="bodyBold" className={summary.tone === "positive" ? "text-primary" : "text-notice-text"}>
          {summary.title}
        </AppText>
        {!!summary.detail && (
          <AppText variant="caption" className="text-notice-text">
            {summary.detail}
          </AppText>
        )}
      </NoticeBanner>

      <View className="rounded-2xl bg-ink-emphasis/5 p-2">
        <StatTiles
          stats={[
            { label: "kcal / serving", value: Math.round(totals.calories / servings).toLocaleString(), emphasis: true },
            { label: "₱ / serving", value: formatPeso(totals.price / servings), emphasis: true },
            { label: "Total kcal", value: Math.round(totals.calories).toLocaleString() },
            { label: "Total ₱", value: formatPeso(totals.price) },
          ]}
        />
      </View>

      <View className="gap-3">
        {rows.map((row) => {
          const source = row.ingredient?.source ?? null;
          const chip = (source ? SOURCE_CHIP[source] : undefined) ?? { label: "Estimated", tone: "neutral" as const };
          const bridgeChip = verifiedBridgeLabel(row);
          return (
            <View key={row.key} className="gap-1.5 border-b border-ink-emphasis/5 pb-3">
              <View className="flex-row flex-wrap items-center gap-1.5">
                <Text className="font-inter-semibold text-body-lg text-ink-emphasis">
                  {row.ingredient?.canonical_name ?? row.name}
                </Text>
                {row.ingredient && <StatusChip label={chip.label} tone={chip.tone} icon={null} />}
                {bridgeChip && <StatusChip label={bridgeChip} tone="success" />}
              </View>
              <Text className="font-inter-regular text-body text-ink-subtle">{rowSummary(row)}</Text>
              {row.problems.map((problem, i) => {
                const id = `calc:${row.key}:${i}`;
                const isError = problem.level === "error";
                return (
                  <View key={id} className="gap-2">
                    <View className="flex-row items-start gap-1.5">
                      <AlertTriangle color={isError ? colors.like : colors.notice.icon} size={15} />
                      <Text className={`flex-1 font-inter-regular text-body leading-5 ${isError ? "text-like" : "text-notice-text"}`}>
                        {problem.message}
                      </Text>
                    </View>
                    {problem.fix && row.ingredient && !fixStates[id] && (
                      <ActionChip
                        label={problem.fix.label}
                        icon={<Check color={colors.primary} size={15} strokeWidth={2.5} />}
                        onPress={() => requestIngredientFix(id, row.ingredient as IngredientRow, problem.fix!.patch)}
                      />
                    )}
                    {fixStatus(id)}
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>

      <View className="gap-3 border-t border-ink-emphasis/10 pt-4">
        <View className="gap-1">
          <AppText variant="bodyBold">Bridge check (optional)</AppText>
          <AppText variant="caption" className="text-ink-subtle">
            AI compares piece weights, densities and quantities with the recipe text. It never changes macros or
            prices.
          </AppText>
        </View>
        <Button
          label={issues ? "Check again" : "Check bridges with AI"}
          variant="outline"
          icon={<Sparkles color={colors.primary} size={16} />}
          loading={loading}
          disabled={countedRows.length === 0}
          onPress={handleBridgeCheck}
        />
        {error && <InlineError>{error}</InlineError>}

        {issues && issues.length === 0 && <StatusChip label="Bridges match the recipe text" tone="success" />}

        {issues?.map((issue, index) => {
          const id = `ai:${index}`;
          const fieldLabel = issue.field === "quantity" ? "quantity" : issue.field.replace(/_/g, " ");
          const issueRow = rows.find((r) => r.key === issue.key);
          const rowQuantity = issueRow ? bridgeFixAsRowQuantity(issue, issueRow) : null;
          return (
            <View key={id} className="gap-3 rounded-2xl border border-ink-emphasis/10 bg-white p-4">
              <View className="flex-row flex-wrap items-center gap-1.5">
                <Text className="font-inter-semibold text-body-lg text-ink-emphasis">{issue.ingredientName}</Text>
                <StatusChip label={fieldLabel} tone="notice" icon={null} />
              </View>
              <Text className="font-inter-regular text-body leading-5 text-ink">{issue.issue}</Text>
              <View className="flex-row items-stretch gap-2">
                <View className="flex-1 rounded-xl bg-ink-emphasis/5 px-3 py-2">
                  <Text className="font-inter-medium text-small text-ink-subtle">Currently</Text>
                  <Text className="font-inter-semibold text-body text-ink-emphasis">{issue.currentValue}</Text>
                </View>
                <View className="justify-center">
                  <ArrowRight color={colors.ink.subtle} size={16} />
                </View>
                <View className="flex-1 rounded-xl bg-primary/10 px-3 py-2">
                  <Text className="font-inter-medium text-small text-primary">Suggested</Text>
                  <Text className="font-inter-semibold text-body text-primary">{issue.suggestedValue}</Text>
                </View>
              </View>
              {!fixStates[id] && rowQuantity && (
                <AppText variant="caption" className="text-ink-subtle">
                  This value is shared by every meal using {issue.ingredientName}. If only this recipe&apos;s is a
                  different size, set this line to {rowQuantity.quantityAmount} g instead.
                </AppText>
              )}
              {!fixStates[id] && (
                <View className="flex-row flex-wrap gap-2">
                  {rowQuantity ? (
                    <>
                      <ActionChip
                        label={`This recipe: ${rowQuantity.quantityAmount} g`}
                        icon={<Check color={colors.primary} size={15} strokeWidth={2.5} />}
                        onPress={() => handleApplyToRow(index, issue, rowQuantity)}
                      />
                      <ActionChip label="Change for all meals" tone="neutral" onPress={() => handleApplyBridgeFix(index, issue)} />
                    </>
                  ) : (
                    <ActionChip
                      label="Accept fix"
                      icon={<Check color={colors.primary} size={15} strokeWidth={2.5} />}
                      onPress={() => handleApplyBridgeFix(index, issue)}
                    />
                  )}
                  <ActionChip label="Skip" tone="neutral" onPress={() => setFix(id, "skipped")} />
                </View>
              )}
              {fixStatus(id)}
            </View>
          );
        })}
      </View>

      <ConfirmIngredientUpdateSheet
        pending={confirmedUpdate.pending}
        affectedMeals={confirmedUpdate.affectedMeals}
        loading={confirmedUpdate.loadingAffected}
        isSaving={confirmedUpdate.isSaving}
        onConfirm={handleConfirmFix}
        onCancel={handleCancelFix}
      />
    </View>
  );
}
