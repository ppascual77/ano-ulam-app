import { Text, View } from "react-native";
import { AppText, BottomSheet, Button } from "@/frontend/components/ui";
import { ProFeatureRow } from "@/frontend/core/pro/components/ProFeatureRow";
import { UNLOCKED_FEATURES } from "@/frontend/core/pro/components/unlockedFeatures";

// Settings > Pro > "See all Pro features": everything the plan includes,
// as the same plain rows the unlock screen shows.
export function ProFeaturesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} fitContent heightPercent={0.9}>
      <View className="px-6 pb-6 pt-10">
        <AppText variant="sectionTitle" dot>
          Everything in Pro
        </AppText>
        <Text className="mt-1 font-inter-regular text-body text-ink-subtle">All of these are on with your plan.</Text>
        <View className="mt-3">
          {UNLOCKED_FEATURES.map((feature, i) => (
            <ProFeatureRow key={feature.key} feature={feature} last={i === UNLOCKED_FEATURES.length - 1} />
          ))}
        </View>
        <View className="mt-5">
          <Button label="Done" variant="muted" onPress={onClose} />
        </View>
      </View>
    </BottomSheet>
  );
}
