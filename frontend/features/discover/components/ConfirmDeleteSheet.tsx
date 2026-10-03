import { Pressable, Text, View } from "react-native";
import { BottomSheet } from "@/frontend/components/ui";

type ConfirmDeleteSheetProps = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

// "Delete this post?" confirmation, copy from the web app's CommunityFeed.
export function ConfirmDeleteSheet({ visible, onCancel, onConfirm }: ConfirmDeleteSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onCancel} heightPercent={0.5} fitContent>
      <View className="items-center gap-5 px-6 pb-8 pt-12">
        <View className="items-center">
          <Text className="font-inter-bold text-subheading text-web-ink">Delete this post?</Text>
          <Text className="mt-1 font-inter-regular text-body text-web-ink-muted">This cannot be undone.</Text>
        </View>
        <View className="w-full flex-row gap-3">
          <Pressable onPress={onCancel} className="flex-1 items-center rounded-xl border border-web-ink-muted py-2.5">
            <Text className="font-inter-medium text-body text-web-ink-soft">Cancel</Text>
          </Pressable>
          <Pressable onPress={onConfirm} className="flex-1 items-center rounded-xl bg-like py-2.5">
            <Text className="font-inter-semibold text-body text-white">Delete</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}
