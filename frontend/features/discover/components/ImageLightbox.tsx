import { Modal, Pressable, View } from "react-native";
import { Image, type ImageSource } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

// Full-screen black viewer for a post photo. Tap the backdrop or the X to
// close.
export function ImageLightbox({ source, onClose }: { source: ImageSource | number | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={!!source} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 items-center justify-center bg-black">
        {source != null && <Image source={source} style={{ width: "100%", height: "100%" }} contentFit="contain" />}
      </Pressable>
      <View className="absolute right-4" style={{ top: insets.top + 12 }}>
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close"
          className="h-9 w-9 items-center justify-center rounded-full bg-white/70"
        >
          <X color={colors.webInk.DEFAULT} size={20} />
        </Pressable>
      </View>
    </Modal>
  );
}
