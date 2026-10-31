import { memo, type ReactNode, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Plus } from "lucide-react-native";
import { AppText, LandingTitle, LoadingState } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { PANTRY_LOADING_LABEL, usePantry, usePantryActions } from "../hooks/usePantry";
import { PantryEmptyState } from "./PantryEmptyState";
import { PantryIngredientTabs } from "./PantryIngredientTabs";
import { PantryMatchCard } from "./PantryMatchCard";
import { PantrySheet } from "./PantrySheet";

// The pantry as one unit, on Home (Pantry mode) and in Profile's Pantry tab:
// the title with an Add Ingredient button, then the empty state, or "What
// can you make?" with the pantry as tabs of chips; and the Add Ingredients
// sheet both open.
//
// `title`: "page" on Home, a LandingTitle (its dot hops between tabs, see
// DotHandoff); "section" inside Profile, a plain dotted subtitle with the
// ingredient count, so no dot tries to land in a tab.
//
// `renderEmpty`: the empty pantry in the host's own style (Profile's tabs
// share one empty state), given a way to open Add Ingredients. Defaults to
// Home's illustrated PantryEmptyState.
type PantrySectionProps = {
  title?: "page" | "section";
  renderEmpty?: (openAdd: () => void) => ReactNode;
};

function PantrySectionInner({ title = "page", renderEmpty }: PantrySectionProps) {
  const { data: pantry = [], isPending } = usePantry();
  const actions = usePantryActions();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        {title === "page" ? (
          <LandingTitle>Your pantry</LandingTitle>
        ) : (
          <View className="flex-row items-baseline gap-1.5">
            <AppText variant="sectionSubtitle" dot>
              Your pantry
            </AppText>
            {pantry.length > 0 && <Text className="font-inter-semibold text-body text-ink-subtle">{pantry.length}</Text>}
          </View>
        )}
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          className="flex-row items-center gap-1.5 rounded-full border border-primary px-4 py-2 active:bg-primary/5"
        >
          <Plus color={colors.primary} size={16} />
          <Text className="font-inter-semibold text-body text-primary">Add Ingredient</Text>
        </Pressable>
      </View>

      {/* Loading first, so an empty pantry never flashes before the real one. */}
      {isPending ? (
        <LoadingState variant="spiral" label={PANTRY_LOADING_LABEL} />
      ) : pantry.length === 0 ? (
        (renderEmpty?.(() => setSheetOpen(true)) ?? <PantryEmptyState onAddIngredients={() => setSheetOpen(true)} />)
      ) : (
        <>
          <PantryMatchCard pantry={pantry} />
          <PantryIngredientTabs pantry={pantry} onRemove={actions.remove} />
        </>
      )}

      <PantrySheet
        visible={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          // Save what was added (Profile's Pantry tab saves when it closes too).
          void actions.persist();
        }}
      />
    </View>
  );
}

// Skips Home's re-renders (any route change re-renders Home, which reads
// its URL params), unless its own props change.
export const PantrySection = memo(PantrySectionInner);
