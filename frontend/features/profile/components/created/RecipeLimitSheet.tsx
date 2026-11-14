import { Pressable, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { AppText, BottomSheet } from "@/frontend/components/ui";
import { RECIPE_LIMIT } from "@/api/recipes";

type RecipeLimitSheetProps = {
  visible: boolean;
  onClose: () => void;
  onClosed?: () => void;
  /** Replaces "Got it" (e.g. "See my recipes" when opened from Add a Recipe). */
  action?: { label: string; onPress: () => void };
};

// "Add a Recipe" at the limit.
export function RecipeLimitSheet({ visible, onClose, onClosed, action }: RecipeLimitSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} onClosed={onClosed} heightPercent={0.5} fitContent>
      <View className="gap-4 p-10">
        <AppText variant="sectionTitle" dot>
          You&apos;ve hit the <Text className="text-accent">recipe limit</Text>
        </AppText>
        <Text className="font-inter-regular text-body text-ink-subtle">
          You can publish up to {RECIPE_LIMIT} recipes. Remove an existing recipe to make room for a new one.
        </Text>
        <Pressable onPress={action?.onPress ?? onClose} className="items-center rounded-2xl bg-primary py-3">
          <Text className="font-inter-semibold text-body text-white">{action?.label ?? "Got it"}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
