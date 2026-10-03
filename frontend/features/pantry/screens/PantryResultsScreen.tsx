import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ChefHat } from "lucide-react-native";
import { Screen } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

function parseList(value: string | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

// STUB — "Find Meals I Can Cook" results. Shows the pantry it was given;
// matching meals against it comes later. Params: JSON arrays `ids` and
// `names` (same order).
export default function PantryResultsScreen() {
  const params = useLocalSearchParams<{ names?: string }>();
  const names = parseList(params.names);

  return (
    <Screen padded={false}>
      <View className="flex-row items-center gap-2 px-5 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="h-9 w-9 justify-center">
          <ArrowLeft color={colors.webInk.DEFAULT} size={20} />
        </Pressable>
        <Text className="font-inter-semibold text-subheading text-web-ink">Meals you can cook</Text>
      </View>

      <View className="gap-4 px-5 pt-4">
        <Text className="font-inter-semibold text-body text-web-ink-body">From your pantry</Text>
        <View className="flex-row flex-wrap gap-2">
          {names.map((name) => (
            <View key={name} className="rounded-full border border-brand-green px-3 py-1">
              <Text className="font-inter-regular text-small text-brand-green">{name}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="flex-1 items-center justify-center gap-3 px-8">
        <ChefHat color={colors.brandGreen.DEFAULT} size={34} strokeWidth={1.5} />
        <Text className="text-center font-inter-bold text-subheading text-web-ink">Meal matching is coming soon</Text>
        <Text className="text-center font-inter-regular text-body text-web-ink-muted">
          We'll suggest meals you can cook with what you already have.
        </Text>
      </View>
    </Screen>
  );
}
