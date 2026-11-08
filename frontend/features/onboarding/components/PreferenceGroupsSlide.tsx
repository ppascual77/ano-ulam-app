import { View } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Settings2 } from "lucide-react-native";
import { AppText, ChipSelect } from "@/frontend/components/ui";
import { HighlightedText } from "./HighlightedText";
import { colors } from "@/frontend/constants/theme";
import type { PreferenceGroup, PreferenceGroupsSlideData } from "../slides";

type Props = {
  slide: PreferenceGroupsSlideData;
  width: number;
  selections: Record<string, string[]>;
  onGroupChange: (groupId: string, value: string[]) => void;
};

// Same header shape as "What matters to you?" (title, one line of how it
// works, the art on the right), then one section per group. The note about changing these later
// sits quietly at the bottom instead of being pushed down by fixed gaps.
export function PreferenceGroupsSlide({ slide, width, selections, onGroupChange }: Props) {
  return (
    <View style={{ width }} className="flex-1 px-8">
      <View className="flex-1 justify-center">
        {/* The title gets the full width (one word, so beside the art its
            dot wrapped); the art sits next to the subtitle instead. */}
        <View className="mb-8">
          <AppText variant="subhero" className="tracking-display" dot>
            {slide.title}
          </AppText>
          <View className="mt-2 flex-row items-center gap-3">
            <HighlightedText className="flex-1">{slide.subtitle}</HighlightedText>
            {slide.image && <Image source={slide.image} style={{ width: 72, height: 72 }} contentFit="contain" />}
          </View>
        </View>

        <View className="gap-8">
          {slide.groups.map((group) => (
            <GroupSection
              key={group.id}
              group={group}
              // Nothing selected (the start) means none.
              value={selections[group.id] ?? []}
              onChange={(value) => {
                Haptics.selectionAsync();
                onGroupChange(group.id, value);
              }}
            />
          ))}
        </View>
      </View>

      <View className="mb-2 flex-row items-center gap-2.5 rounded-2xl bg-primary/5 px-4 py-3">
        <Settings2 color={colors.primary} size={16} />
        <AppText variant="caption" className="flex-1 text-primary">
          {slide.note}
        </AppText>
      </View>
    </View>
  );
}

function GroupSection({ group, value, onChange }: { group: PreferenceGroup; value: string[]; onChange: (value: string[]) => void }) {
  return (
    <View>
      <AppText variant="sectionSubtitle" dot className="mb-4">
        {group.title}
      </AppText>
      <ChipSelect options={group.options} mode={group.mode} clearable value={value} onChange={onChange} />
    </View>
  );
}
