import { View } from "react-native";
import * as Haptics from "expo-haptics";
import { Utensils } from "lucide-react-native";
import { AppText, ChipSelect, Stepper } from "@/frontend/components/ui";
import { Text } from "@/frontend/components/ui/Text";
import { colors } from "@/frontend/constants/theme";
import { HighlightedText } from "./HighlightedText";
import type { BudgetSlideData } from "../slides";

const MAX_SERVINGS = 10;

type Props = {
  slide: BudgetSlideData;
  width: number;
  budget: number;
  servings: number;
  onBudgetChange: (budget: number) => void;
  onServingsChange: (servings: number) => void;
};

// Onboarding's last question before the account pitch: a budget for
// tonight's ulam and how many it feeds. Home opens with meals for it
// already suggested, so a first look at the app is an answer, not a menu.
// Same shape as the other question slides (title, one line, the controls).
export function BudgetSlide({ slide, width, budget, servings, onBudgetChange, onServingsChange }: Props) {
  return (
    <View style={{ width }} className="flex-1 px-8">
      <View className="flex-1 justify-center">
        <View className="mb-8">
          <AppText variant="subhero" className="tracking-display" dot>
            {slide.title}
          </AppText>
          <HighlightedText className="mt-2">{slide.subtitle}</HighlightedText>
        </View>

        <View className="gap-7">
          <View>
            <AppText variant="sectionSubtitle" dot className="mb-4">
              Budget
            </AppText>
            <ChipSelect
              options={slide.budgets.map((amount) => ({ id: String(amount), label: `₱${amount}` }))}
              mode="single"
              required
              value={[String(budget)]}
              onChange={(value) => {
                if (!value[0]) return;
                Haptics.selectionAsync();
                onBudgetChange(Number(value[0]));
              }}
            />
          </View>

          <View>
            <AppText variant="sectionSubtitle" dot className="mb-4">
              Cooking for
            </AppText>
            <View className="flex-row items-center gap-4">
              <Stepper
                value={servings}
                min={1}
                max={MAX_SERVINGS}
                onChange={onServingsChange}
                decrementLabel="Fewer people"
                incrementLabel="More people"
              />
              <Text className="font-inter-medium text-body text-ink-subtle">{servings === 1 ? "person" : "people"}</Text>
            </View>
          </View>
        </View>
      </View>

      <View className="mb-2 flex-row items-center gap-2.5 rounded-2xl bg-primary/5 px-4 py-3">
        <Utensils color={colors.primary} size={16} />
        <AppText variant="caption" className="flex-1 text-primary">
          {`Meals for about ₱${budget}, cooking for ${servings}, will be waiting on Home.`}
        </AppText>
      </View>
    </View>
  );
}
