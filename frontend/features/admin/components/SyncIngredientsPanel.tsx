import { useMemo, useState } from "react";
import { View, Pressable, Linking } from "react-native";
import { Check, ExternalLink, Search } from "lucide-react-native";
import { AppText, Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import {
  applyUsdaMatch,
  createIngredient,
  getUsdaSourceUrl,
  groundIngredientsUsda,
  type IngredientRow,
  type UsdaGroundingMatch,
} from "@/api/ingredients";
import {
  computeProposedTotals,
  convertQuantityToBasis,
  matchIngredientCandidates,
} from "@/api/meals";
import type { PendingMealIngredient } from "./SeedMealIngredientsEditor";

const SOURCE_TONE: Record<string, string> = {
  USDA: "text-primary",
  FNRI: "text-accent",
  manual: "text-ink-subtle",
};

type Props = {
  items: PendingMealIngredient[];
  allIngredients: IngredientRow[];
  onResolve: (key: string, ingredient: IngredientRow) => void;
};

// Per-row USDA search state, keyed by the pending ingredient's local key —
// separate from the DB-candidate matching below since it's a deliberate,
// on-demand fallback only shown once the admin decides nothing in our own
// ingredients table is a good match.
type UsdaSearchState = {
  loading: boolean;
  candidates: UsdaGroundingMatch[] | null;
  error: string | null;
};

export function SyncIngredientsPanel({ items, allIngredients, onResolve }: Props) {
  const [usdaSearch, setUsdaSearch] = useState<Record<string, UsdaSearchState>>({});
  const [creatingKey, setCreatingKey] = useState<string | null>(null);

  const unresolved = items.filter((i) => !i.ingredientId);
  const resolvedCount = items.length - unresolved.length;

  const candidatesByKey = useMemo(() => {
    const map = new Map<string, ReturnType<typeof matchIngredientCandidates>>();
    for (const item of unresolved) {
      map.set(item.key, matchIngredientCandidates(item.name, allIngredients));
    }
    return map;
  }, [unresolved, allIngredients]);

  const handleSearchUsda = async (item: PendingMealIngredient) => {
    setUsdaSearch((prev) => ({ ...prev, [item.key]: { loading: true, candidates: null, error: null } }));
    try {
      const [result] = await groundIngredientsUsda([{ id: item.key, canonicalName: item.name }]);
      if (!result || result.confidence === "NONE") {
        setUsdaSearch((prev) => ({
          ...prev,
          [item.key]: { loading: false, candidates: [], error: null },
        }));
        return;
      }
      if (result.confidence === "ERROR") {
        setUsdaSearch((prev) => ({
          ...prev,
          [item.key]: { loading: false, candidates: null, error: result.error },
        }));
        return;
      }
      setUsdaSearch((prev) => ({
        ...prev,
        [item.key]: { loading: false, candidates: result.candidates, error: null },
      }));
    } catch (err) {
      setUsdaSearch((prev) => ({
        ...prev,
        [item.key]: { loading: false, candidates: null, error: err instanceof Error ? err.message : String(err) },
      }));
    }
  };

  const handleAddAndUse = async (item: PendingMealIngredient, candidate: UsdaGroundingMatch) => {
    setCreatingKey(item.key);
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
      onResolve(item.key, created);
    } finally {
      setCreatingKey(null);
    }
  };

  return (
    <View className="gap-3 rounded-2xl border border-ink-emphasis/10 p-3">
      <AppText variant="bodyBold">Sync ingredients from DB</AppText>
      <AppText variant="caption" className="text-ink-subtle">
        {resolvedCount} of {items.length} resolved
        {unresolved.length > 0 ? ` · ${unresolved.length} still need a match` : ""}
      </AppText>

      {unresolved.length === 0 && items.length > 0 && (
        <AppText variant="caption" className="text-primary">
          All ingredients are linked to a real ingredient record.
        </AppText>
      )}

      {unresolved.map((item) => {
        const candidates = candidatesByKey.get(item.key) ?? [];
        const search = usdaSearch[item.key];
        const amount = Number(item.quantityAmount);
        const hasQty = item.quantityAmount.trim() !== "" && !Number.isNaN(amount);

        return (
          <View key={item.key} className="gap-2 border-t border-ink-emphasis/10 pt-3">
            <AppText variant="bodyBold">{item.name || "(unnamed ingredient)"}</AppText>

            {candidates.length === 0 && !search && (
              <AppText variant="caption" className="text-ink-subtle">
                No close match found in ingredients.
              </AppText>
            )}

            {candidates.map(({ ingredient, score }) => {
              const conversion = hasQty
                ? convertQuantityToBasis(amount, item.quantityUnit, ingredient)
                : { ok: false as const, reason: "Enter a quantity first" };
              const proposed = computeProposedTotals(ingredient, conversion);
              return (
                <Pressable
                  key={ingredient.id}
                  onPress={() => onResolve(item.key, ingredient)}
                  className="flex-row items-start gap-3 rounded-xl border border-ink-emphasis/10 p-3"
                >
                  <View className="w-6 h-6 rounded-md items-center justify-center border border-primary/20 mt-0.5">
                    <Check color={colors.primary} size={14} />
                  </View>
                  <View className="flex-1 gap-1">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <AppText variant="body">{ingredient.canonical_name}</AppText>
                      {ingredient.source && (
                        <AppText variant="caption" className={SOURCE_TONE[ingredient.source] ?? "text-ink-subtle"}>
                          {ingredient.source}
                        </AppText>
                      )}
                      <AppText variant="caption" className="text-ink-subtle">
                        score {score}
                      </AppText>
                    </View>
                    {conversion.ok ? (
                      <AppText variant="caption" className="text-ink-subtle">
                        → {proposed.calories?.toFixed(0) ?? "?"} cal · {proposed.protein?.toFixed(1) ?? "?"}g P ·{" "}
                        {proposed.carbohydrates?.toFixed(1) ?? "?"}g C · {proposed.fat?.toFixed(1) ?? "?"}g F
                        {proposed.price != null ? ` · ₱${proposed.price.toFixed(2)}` : ""}
                      </AppText>
                    ) : (
                      <AppText variant="caption" className="text-like">
                        {conversion.reason}
                      </AppText>
                    )}
                  </View>
                </Pressable>
              );
            })}

            <View className="flex-row items-center gap-4">
              <Pressable
                onPress={() => handleSearchUsda(item)}
                disabled={search?.loading}
                className="flex-row items-center gap-1"
              >
                <Search color={colors.primary} size={14} />
                <AppText variant="caption" className="text-primary">
                  {search?.loading ? "Searching USDA..." : "Search USDA"}
                </AppText>
              </Pressable>
            </View>

            {search?.error && (
              <AppText variant="caption" className="text-like">
                {search.error}
              </AppText>
            )}

            {search?.candidates?.length === 0 && (
              <AppText variant="caption" className="text-ink-subtle">
                No USDA match either — try adjusting the name.
              </AppText>
            )}

            {search?.candidates?.map((c) => (
              <View key={c.fdcId} className="flex-row items-center justify-between gap-2 rounded-xl bg-ink-emphasis/5 p-2">
                <View className="flex-1 gap-1">
                  <Pressable
                    onPress={() => Linking.openURL(getUsdaSourceUrl(c.fdcId))}
                    className="flex-row items-center gap-1"
                  >
                    <AppText variant="caption" numberOfLines={1}>
                      {c.description}
                    </AppText>
                    <ExternalLink color={colors.ink.subtle} size={10} />
                  </Pressable>
                  <AppText variant="caption" className="text-ink-subtle">
                    {c.calories ?? "?"} cal/100g
                  </AppText>
                </View>
                <Button
                  label={creatingKey === item.key ? "Adding..." : "Add + use"}
                  variant="outline"
                  disabled={creatingKey === item.key}
                  onPress={() => handleAddAndUse(item, c)}
                />
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
