import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { BookmarkX, PenLine, RefreshCw } from "lucide-react-native";
import { AppText, BottomSheet } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useLastDefined } from "../../hooks/useLastDefined";

type UpdatedMealPromptProps = {
  /** null closes the sheet. */
  name: string | null;
  syncing: boolean;
  onClose: () => void;
  onClosed?: () => void;
  onSync: () => void;
  onUnsave: () => void;
  onViewSaved: () => void;
};

function SpinningRefresh({ spinning }: { spinning: boolean }) {
  const rotation = useSharedValue(0);
  useEffect(() => {
    if (spinning) {
      rotation.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(rotation);
      rotation.value = 0;
    }
  }, [spinning, rotation]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <RefreshCw color={colors.white} size={15} />
    </Animated.View>
  );
}

// Tapping a saved meal whose creator edited the recipe: sync to the latest
// version, unsave it, or open the copy that was saved.
export function UpdatedMealPrompt({ name, syncing, onClose, onClosed, onSync, onUnsave, onViewSaved }: UpdatedMealPromptProps) {
  const shownName = useLastDefined(name);
  return (
    <BottomSheet visible={!!name} onClose={syncing ? () => {} : onClose} onClosed={onClosed} heightPercent={0.6} fitContent>
      <View className="items-center gap-5 px-6 pb-8 pt-12">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-info-soft">
          <PenLine color={colors.info} size={22} />
        </View>
        <View className="items-center">
          <AppText variant="sectionTitle" dot>This meal was updated</AppText>
          <Text className="mt-1 max-w-[260px] text-center font-inter-regular text-body text-web-ink-muted">
            The creator of <Text className="font-inter-medium text-web-ink-soft">{shownName}</Text> has made changes to this
            recipe. You can sync to get the latest version, or unsave it from your list.
          </Text>
        </View>
        <View className="w-full gap-2">
          <Pressable
            onPress={onSync}
            disabled={syncing}
            className={`flex-row items-center justify-center gap-2 rounded-xl bg-brand-green py-2.5 ${syncing ? "opacity-60" : ""}`}
          >
            <SpinningRefresh spinning={syncing} />
            <Text className="font-inter-semibold text-body text-white">{syncing ? "Syncing…" : "Sync latest version"}</Text>
          </Pressable>
          <Pressable
            onPress={onUnsave}
            disabled={syncing}
            className="flex-row items-center justify-center gap-2 rounded-xl border border-web-divider py-2.5"
          >
            <BookmarkX color={colors.webInk.body} size={15} />
            <Text className="font-inter-medium text-body text-web-ink-body">Unsave</Text>
          </Pressable>
          <Pressable onPress={onViewSaved} disabled={syncing} className="items-center py-1.5">
            <Text className="font-inter-regular text-body text-web-ink-muted">View saved version</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}
