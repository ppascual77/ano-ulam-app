import type { ComponentProps } from "react";
import { View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import Animated from "react-native-reanimated";
import { Check, Minus } from "lucide-react-native";
import { AppText } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { COMPARE_ROWS, type CompareCell } from "../proContent";
import { ProBadge } from "./ProBadge";

// The Pro page's premium table (and, Pro column only, the "You're Pro"
// screen's list after unlocking).

function Cell({ value, pro }: { value: CompareCell; pro?: boolean }) {
  if (value === true) return <Check color={pro ? colors.accent : colors.primary} size={18} strokeWidth={3} />;
  if (value === false) return <Minus color={colors.ink.placeholder} size={16} />;
  return (
    <Text className={`text-center font-inter-semibold text-small ${pro ? "text-accent" : "text-ink-subtle"}`} numberOfLines={1}>
      {value}
    </Text>
  );
}

// The compact Pro-only table's width (centered on wider screens).
const PRO_ONLY_WIDTH = 300;

type RowEntering = ComponentProps<typeof Animated.View>["entering"];

// Free vs Pro, with the Pro column tinted orange top to bottom. `proOnly`
// (the "You're Pro" screen after unlocking): just what Pro adds, with no
// Free column (nothing left to compare), under its own title; rows can
// rise in turn (`rowEntering`).
export function CompareTable({ title = "Free vs Pro", proOnly = false, rowEntering }: { title?: string; proOnly?: boolean; rowEntering?: (index: number) => RowEntering }) {
  // Pro only: just what Pro adds, no Free column, in a narrower centered
  // table, so each label sits near its value instead of across the screen.
  const rows = proOnly ? COMPARE_ROWS.filter((row) => row.free !== row.pro) : COMPARE_ROWS;
  const band = "w-24";
  const rowPad = "py-3";
  return (
    // No grid: whitespace lines the rows up, and the Pro column is one soft
    // orange band behind its cells (a little wider than Free's, so "Whole
    // week" fits with room). The title shares the header row with the Free
    // and PRO column labels.
    <View style={proOnly ? { width: "100%", maxWidth: PRO_ONLY_WIDTH, alignSelf: "center" } : undefined}>
      <View pointerEvents="none" className={`absolute bottom-0 right-0 top-0 rounded-2xl bg-accent/5 ${band}`} />
      <View className="flex-row items-center">
        <View className="flex-1 pr-2">
          <AppText variant="sectionSubtitle" dot>
            {title}
          </AppText>
        </View>
        {!proOnly && (
          <View className="w-20 items-center py-3">
            <Text className="font-inter-bold text-small text-ink-subtle">Free</Text>
          </View>
        )}
        <View className={`items-center py-3 ${band}`}>
          <ProBadge />
        </View>
      </View>
      {rows.map((row, i) => (
        <Animated.View key={row.label} entering={rowEntering?.(i)}>
          <View className="flex-row items-stretch">
            <Text className={`flex-1 pr-2 font-inter-medium text-body text-ink-emphasis ${rowPad}`}>{row.label}</Text>
            {!proOnly && (
              <View className="w-20 items-center justify-center py-3">
                <Cell value={row.free} />
              </View>
            )}
            <View className={`items-center justify-center ${band} ${rowPad}`}>
              <Cell value={row.pro} pro />
            </View>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

