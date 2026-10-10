import { Pressable, Text, View } from "react-native";
import { AppText, BottomSheet } from "@/frontend/components/ui";
import { RECIPE_LIMIT } from "@/api/recipes";

// "Add a Recipe" at the limit.
export function RecipeLimitSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} heightPercent={0.5} fitContent>
      <View className="gap-4 p-10">
        <AppText variant="sectionTitle" dot>
          You&apos;ve hit the <Text className="text-brand-orange">recipe limit</Text>
        </AppText>
        <Text className="font-inter-regular text-body text-web-ink-muted">
          You can publish up to {RECIPE_LIMIT} recipes. Remove an existing recipe to make room for a new one.
        </Text>
        <Pressable onPress={onClose} className="items-center rounded-2xl bg-brand-green py-3">
          <Text className="font-inter-semibold text-body text-white">Got it</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
