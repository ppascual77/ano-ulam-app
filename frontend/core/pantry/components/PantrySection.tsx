import { memo, type ReactNode, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { Plus } from "lucide-react-native";
import { AppText, LandingTitle, LoadingState } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { PANTRY_LOADING_LABEL, usePantry, usePantryActions } from "../hooks/usePantry";
import { usePantryResultsGate } from "../hooks/usePantryResultsGate";
import { PantryEmptyState } from "./PantryEmptyState";
import { PantryIngredientTabs } from "./PantryIngredientTabs";
import { PantryMatchCard } from "./PantryMatchCard";
import { PantrySheet } from "./PantrySheet";

// The pantry as one unit, on Home (Pantry mode) and in Profile's Pantry tab:
// the title with an Add ingredients button, then the empty state, or "What
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

export const ADD_INGREDIENTS_LABEL = "Add ingredients";

function PantrySectionInner({ title = "page", renderEmpty }: PantrySectionProps) {
  const { data: pantry = [], isPending } = usePantry();
  const actions = usePantryActions();
  const [sheetOpen, setSheetOpen] = useState(false);
  // The sheet's "Show N meals": open the results once the sheet has fully
  // closed (a route push under a closing Modal can get lost).
  const gate = usePantryResultsGate();
  const showAfterClose = useRef(false);
  const pantryRef = useRef(pantry);
  pantryRef.current = pantry;

  const closeSheet = () => {
    setSheetOpen(false);
    // Save what was added (Profile's Pantry tab saves when it closes too).
    void actions.persist();
  };

  // Only one Add ingredients button on screen: the empty state has its
  // own, so the header's shows once there's something in the pantry.
  const hasItems = !isPending && pantry.length > 0;

  return (
    <View className="gap-4">
      <View className="min-h-10 flex-row items-center justify-between">
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
        {hasItems && (
          <Pressable
            onPress={() => setSheetOpen(true)}
            accessibilityRole="button"
            className="flex-row items-center gap-1.5 rounded-full border border-primary px-4 py-2 active:bg-primary/5"
          >
            <Plus color={colors.primary} size={16} />
            <Text className="font-inter-semibold text-body text-primary">{ADD_INGREDIENTS_LABEL}</Text>
          </Pressable>
        )}
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
        onClose={closeSheet}
        onShowMeals={() => {
          showAfterClose.current = true;
          closeSheet();
        }}
        onClosed={() => {
          if (!showAfterClose.current) return;
          showAfterClose.current = false;
          void gate.openResults(pantryRef.current);
        }}
      />
      {gate.limitSheet}
    </View>
  );
}

// Skips Home's re-renders (any route change re-renders Home, which reads
// its URL params), unless its own props change.
export const PantrySection = memo(PantrySectionInner);
