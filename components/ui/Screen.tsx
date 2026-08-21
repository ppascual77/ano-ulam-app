import { ReactNode } from "react";
import { Keyboard, TouchableWithoutFeedback, View } from "react-native";
import { SafeAreaView, Edge } from "react-native-safe-area-context";

type ScreenProps = {
  children: ReactNode;
  edges?: Edge[];
  /** Set false for full-bleed content (e.g. a swipeable carousel) that can't have side padding. */
  padded?: boolean;
  className?: string;
};

export function Screen({
  children,
  edges = ["top", "bottom"],
  padded = true,
  className = "",
}: ScreenProps) {
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-white">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View className={`flex-1 ${padded ? "px-7 py-2" : ""} ${className}`}>{children}</View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}
