import { type RefObject, useMemo, useRef } from "react";
import { Pressable, View, type ViewInstance } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { Check, Plus } from "lucide-react-native";
import { Spinner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { IngredientRow } from "@/api/ingredients";
import { searchIngredients } from "@/frontend/core/meals/components/IngredientSearch";
import { pantryName } from "../pantryName";

const RESULT_LIMIT = 6;

/** Where a pick was tapped, in window coordinates (the add flies from here). */
export type PickOrigin = { x: number; y: number } | null;
export type OnPick = (ingredient: IngredientRow, origin: PickOrigin) => void;

// Measures `ref` and hands the pick on with where it was on screen.
function pickFrom(ref: RefObject<ViewInstance | null>, ingredient: IngredientRow, onPick: OnPick) {
  const node = ref.current;
  if (!node) return onPick(ingredient, null);
  node.measureInWindow((x, y) => onPick(ingredient, { x, y }));
}

// The name a match came through when it wasn't the ingredient's own name
// ("bawang" for garlic), so the result explains itself.
function matchedAlias(ingredient: IngredientRow, q: string): string | null {
  const own = [pantryName(ingredient.canonical_name), ingredient.canonical_name, ingredient.display_name ?? ""];
  if (own.some((n) => n.toLowerCase().includes(q))) return null;
  return ingredient.aliases.find((a) => a.toLowerCase().includes(q)) ?? null;
}

function ResultRow({
  ingredient,
  subtitle,
  added,
  onPick,
}: {
  ingredient: IngredientRow;
  subtitle: string | null;
  added: boolean;
  onPick: OnPick;
}) {
  const labelRef = useRef<ViewInstance>(null);
  const name = pantryName(ingredient.canonical_name);
  return (
    <Pressable
      onPress={() => pickFrom(labelRef, ingredient, onPick)}
      disabled={added}
      accessibilityRole="button"
      accessibilityLabel={added ? `${name}, already added` : `Add ${name}`}
      className="flex-row items-center gap-3 py-3 active:opacity-60"
    >
      <View ref={labelRef} className="flex-1">
        <Text numberOfLines={1} className={`font-inter-medium text-body ${added ? "text-ink-placeholder" : "text-ink-emphasis"}`}>
          {name}
        </Text>
        {subtitle && (
          <Text numberOfLines={1} className="font-inter-regular text-small text-ink-subtle">
            {subtitle}
          </Text>
        )}
      </View>
      {added ? (
        <View className="flex-row items-center gap-1">
          <Check color={colors.primary} size={14} />
          <Text className="font-inter-semibold text-small text-primary">Added</Text>
        </View>
      ) : (
        <View className="h-7 w-7 items-center justify-center rounded-full bg-primary/10">
          <Plus color={colors.primary} size={16} />
        </View>
      )}
    </Pressable>
  );
}

// As-you-type results over the catalog (searchIngredients), shown the way
// the pantry names things: the everyday name, and the alias it matched on
// when that's what matched.
export function PantrySearchResults({
  query,
  catalog,
  isLoading,
  addedIds,
  onPick,
}: {
  query: string;
  catalog: IngredientRow[] | undefined;
  isLoading: boolean;
  addedIds: Set<string>;
  onPick: OnPick;
}) {
  const q = query.trim().toLowerCase();
  const results = useMemo(() => (catalog ? searchIngredients(q, catalog, RESULT_LIMIT) : []), [q, catalog]);

  // Two catalog rows can share an everyday name ("Chicken breast, raw" and
  // "…, bone-in, raw"); those show their catalog name to tell them apart.
  const subtitles = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of results) counts.set(pantryName(r.canonical_name), (counts.get(pantryName(r.canonical_name)) ?? 0) + 1);
    return new Map(
      results.map((r) => [
        r.id,
        matchedAlias(r, q) ?? ((counts.get(pantryName(r.canonical_name)) ?? 0) > 1 ? r.canonical_name : null),
      ]),
    );
  }, [results, q]);

  if (isLoading && !catalog) {
    return (
      <View className="items-center py-6">
        <Spinner variant="spiral" size={20} color={colors.primary} />
      </View>
    );
  }

  if (results.length === 0) {
    return (
      <View className="items-center px-6 py-8">
        <Text className="text-center font-inter-semibold text-body text-ink-emphasis">No “{query.trim()}” yet</Text>
        <Text className="mt-1 text-center font-inter-regular text-small text-ink-subtle">
          Try another name, like “bawang” for garlic.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {results.map((ingredient, i) => (
        <View key={ingredient.id} className={i === results.length - 1 ? "" : "border-b border-ink-emphasis/5"}>
          <ResultRow ingredient={ingredient} subtitle={subtitles.get(ingredient.id) ?? null} added={addedIds.has(ingredient.id)} onPick={onPick} />
        </View>
      ))}
    </View>
  );
}

function QuickChip({ ingredient, onPick }: { ingredient: IngredientRow; onPick: OnPick }) {
  const ref = useRef<ViewInstance>(null);
  const name = pantryName(ingredient.canonical_name);
  return (
    <Pressable
      ref={ref}
      onPress={() => pickFrom(ref, ingredient, onPick)}
      accessibilityRole="button"
      accessibilityLabel={`Add ${name}`}
      className="flex-row items-center gap-1.5 rounded-full border border-ink-emphasis/10 bg-white py-2 pl-3.5 pr-3 active:bg-ink-emphasis/5"
    >
      <Text className="font-inter-medium text-body text-ink-emphasis">{name}</Text>
      <Plus color={colors.primary} size={14} />
    </Pressable>
  );
}

// A titled row of one-tap adds (Quick add, Recently removed). Hidden when
// there's nothing left to offer.
export function QuickAddChips({ title, items, onPick }: { title: string; items: IngredientRow[]; onPick: OnPick }) {
  if (items.length === 0) return null;
  return (
    <View className="gap-2">
      <Text className="font-inter-bold text-sub uppercase tracking-widest text-ink-subtle">{title}</Text>
      <View className="flex-row flex-wrap gap-2">
        {items.map((ingredient) => (
          <QuickChip key={ingredient.id} ingredient={ingredient} onPick={onPick} />
        ))}
      </View>
    </View>
  );
}
