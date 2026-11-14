import { View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { AppText, Button } from "@/frontend/components/ui";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

// Onboarding slide 1's magnifying glass: "we looked".
const GIF = require("@/assets/onboarding/slide-1.gif");
const GIF_WIDTH = 220;
const GIF_RATIO = 675 / 642;

const peso = (n: number) => `₱${Math.round(n).toLocaleString("en-US")}`;

// Suggest by Budget when nothing fits, centered: what happened (more meals
// are being curated) and the way forward (a bigger budget or fewer
// servings, in the form above; or another category, when one is picked).
// `category`: the picked Categories tile, lowercase ("breakfast"). `title`
// and `body` override the default wording (e.g. when the user's dietary
// focus is what leaves nothing); `action` adds a button (e.g. Change
// preferences).
export function BudgetEmptyState({
  budget,
  category,
  title,
  body,
  action,
}: {
  budget: number;
  category?: string;
  title?: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}) {
  const reduceMotion = useReduceMotion();
  return (
    <Animated.View
      entering={reduceMotion ? FadeIn.duration(200) : FadeInDown.duration(420)}
      className="items-center px-4 pb-4 pt-2"
    >
      <Image source={GIF} style={{ width: GIF_WIDTH, height: GIF_WIDTH / GIF_RATIO }} contentFit="contain" accessibilityIgnoresInvertColors />

      <AppText variant="sectionSubtitle" dot className="mt-2 text-center">
        {title ?? (category ? `No ${category} fits ${peso(budget)} yet` : `Nothing fits ${peso(budget)} yet`)}
      </AppText>

      <Text className="mt-2 max-w-[300px] text-center font-inter-regular text-body text-ink-subtle">
        {body ??
          (category
            ? "We're still curating more meals for every budget. For now, try another category or a bigger budget."
            : "We're still curating more meals for every budget. For now, try a bigger budget or fewer servings.")}
      </Text>

      {action && (
        <View className="mt-6 self-stretch">
          <Button label={action.label} variant="outline" onPress={action.onPress} />
        </View>
      )}
    </Animated.View>
  );
}
