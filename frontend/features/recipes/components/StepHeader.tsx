import { View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { AppText } from "@/frontend/components/ui";

// The same opening on every step of Add a Recipe: a dotted title and one
// line on what the step is for, so the four steps read as one form.
export function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View className="gap-1">
      <AppText variant="sectionTitle" dot>
        {title}
      </AppText>
      <Text className="font-inter-regular text-body text-ink-subtle">{subtitle}</Text>
    </View>
  );
}
