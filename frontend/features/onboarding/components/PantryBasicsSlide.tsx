import { View } from "react-native";
import * as Haptics from "expo-haptics";
import { Refrigerator } from "lucide-react-native";
import { AppText, ChipSelect } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { PANTRY_STAPLES, STAPLE_GROUPS } from "@/frontend/core/pantry/staples";
import { HighlightedText } from "./HighlightedText";
import type { PantryBasicsSlideData } from "../slides";

type Props = {
  slide: PantryBasicsSlideData;
  width: number;
  /** The ticked basics, by label. */
  selected: string[];
  onChange: (selected: string[]) => void;
};

// The pantry's starting point: the basics most Filipino kitchens already
// have, ticked for you, so the grocery list doesn't ask you to buy soy
// sauce on day one. Same shape as the Preferences slide (title, one line of
// how it works, a section per group) and the same chips.
export function PantryBasicsSlide({ slide, width, selected, onChange }: Props) {
  const count = selected.length;
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
          {STAPLE_GROUPS.map((group) => {
            const labels = PANTRY_STAPLES.filter((staple) => staple.group === group.key).map((staple) => staple.label);
            return (
              <View key={group.key}>
                <AppText variant="sectionSubtitle" dot className="mb-4">
                  {group.label}
                </AppText>
                <ChipSelect
                  options={labels.map((label) => ({ id: label, label }))}
                  mode="multi"
                  value={selected.filter((label) => labels.includes(label))}
                  onChange={(value) => {
                    Haptics.selectionAsync();
                    onChange([...selected.filter((label) => !labels.includes(label)), ...value]);
                  }}
                />
              </View>
            );
          })}
        </View>
      </View>

      <View className="mb-2 flex-row items-center gap-2.5 rounded-2xl bg-primary/5 px-4 py-3">
        <Refrigerator color={colors.primary} size={16} />
        <AppText variant="caption" className="flex-1 text-primary">
          {count === 0
            ? "Nothing ticked: you can add basics to your pantry anytime."
            : `${count} basic${count === 1 ? "" : "s"} go to your pantry. Change them anytime in Profile.`}
        </AppText>
      </View>
    </View>
  );
}
