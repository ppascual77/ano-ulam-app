import { Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import { CalendarCheck } from "lucide-react-native";
import { Text } from "@/frontend/components/ui/Text";
import { colors } from "@/frontend/constants/theme";
import { useCleanupNote, useUndoCleanup } from "../hooks/useCleanupNote";

// How many names before "and N more".
const NAMES_SHOWN = 3;

// Under the pantry list (Home's By Pantry, Profile's Pantry tab), while Home's cleanup note is fresh: which plan day
// finished and what it took out, with Undo. Home's pill is easy to miss, and
// this is where someone looks when the chicken is gone. A soft green card,
// one short title, the items under it: calm, no motion beyond a fade.
export function PantryCleanupLine() {
  const note = useCleanupNote();
  const undoCleanup = useUndoCleanup();
  if (!note) return null;

  const names = note.items.map((item) => item.name.toLowerCase());
  const shown = names.slice(0, NAMES_SHOWN);
  const more = names.length - shown.length;
  const parts = more > 0 ? [...shown, `${more} more`] : shown;
  const list = parts.map((part, i) => `${i === 0 ? "" : i === parts.length - 1 ? " and " : ", "}${part}`).join("");
  // "Saturday's plan is done" / "Your past plan days are done".
  const title = `${note.when} ${note.when.endsWith("days") ? "are" : "is"} done`;

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      accessible
      accessibilityLabel={`${title}. We took out ${list}.`}
      className="flex-row items-center gap-3 rounded-2xl border border-primary/10 bg-primary/5 py-2.5 pl-2.5 pr-3"
    >
      <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/10">
        <CalendarCheck color={colors.primary} size={16} strokeWidth={2.2} />
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="font-inter-semibold text-small text-ink-emphasis">
          {title}
        </Text>
        <Text numberOfLines={2} className="font-inter-regular text-sub text-ink-subtle">
          We took out {list}
        </Text>
      </View>
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          undoCleanup(note);
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Undo: put ${note.items.map((item) => item.name).join(", ")} back in your pantry`}
        className="rounded-full border border-primary/15 bg-white px-3 py-1 active:bg-primary/10"
      >
        <Text className="font-inter-semibold text-small text-primary">Undo</Text>
      </Pressable>
    </Animated.View>
  );
}
