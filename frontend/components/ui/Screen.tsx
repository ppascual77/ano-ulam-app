import { ReactNode } from "react";
import { Keyboard, TouchableWithoutFeedback, View } from "react-native";
import { SafeAreaView, Edge } from "react-native-safe-area-context";

type ScreenProps = {
  children: ReactNode;
  edges?: Edge[];
  /** Set false for full-bleed content (e.g. a swipeable carousel) that can't have side padding. */
  padded?: boolean;
  className?: string;
  /** Tap anywhere to dismiss the keyboard (default). This wraps the screen
   *  in a TouchableWithoutFeedback, which can swallow swipes meant for a
   *  ScrollView inside it (it did on Add a Recipe's long Preview step).
   *  Screens built around a scrolling form should turn it off and use the
   *  ScrollView's keyboardDismissMode instead. */
  dismissKeyboardOnTap?: boolean;
};

export function Screen({
  children,
  edges = ["top", "bottom"],
  padded = true,
  className = "",
  dismissKeyboardOnTap = true,
}: ScreenProps) {
  const content = <View className={`flex-1 ${padded ? "px-7 py-2" : ""} ${className}`}>{children}</View>;
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-white">
      {dismissKeyboardOnTap ? (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          {content}
        </TouchableWithoutFeedback>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
