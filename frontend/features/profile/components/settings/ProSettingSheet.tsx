import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { AppText, BottomSheet, Button } from "@/frontend/components/ui";

type ProSettingSheetProps = {
  visible: boolean;
  title: string;
  subtitle: string;
  /** The bottom button: "Save" for forms, "Done" when edits save as you go. */
  actionLabel: string;
  onAction: () => void;
  onClose: () => void;
  children: ReactNode;
};

// The frame every Pro setting opens in (Settings > Pro): dotted title and a
// line on what it's for, the controls, one button at the bottom.
export function ProSettingSheet({ visible, title, subtitle, actionLabel, onAction, onClose, children }: ProSettingSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} heightPercent={0.8}>
      <View className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-5 px-5 pb-4 pt-10">
          <View>
            <AppText variant="sectionTitle" dot>
              {title}
            </AppText>
            <Text className="mt-0.5 font-inter-regular text-small text-web-ink-muted">{subtitle}</Text>
          </View>
          {children}
        </ScrollView>
        <View className="px-5 pb-4 pt-2">
          <Button label={actionLabel} onPress={onAction} />
        </View>
      </View>
    </BottomSheet>
  );
}
