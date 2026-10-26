import { memo } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { AppText } from "@/frontend/components/ui";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

type HeaderProps = {
  /** Undefined/guest shows "Hello" only, no name. */
  name?: string;
};

// The avatar (and the admin menu) moved to the bottom nav's Profile tab.
function HeaderInner({ name }: HeaderProps) {
  // Reduce motion: the "today?" GIF holds still on its first frame.
  // `autoplay` only applies when the image loads, and Home stays mounted
  // while the setting changes, so the key reloads it either way.
  const reduceMotion = useReduceMotion();
  return (
    <View className="ml-2 flex-row items-center justify-between">
      <View>
        <AppText variant="title">
          {name ? (
            <>
              Hello, <Text className="font-inter-bold text-primary">{name}</Text>
            </>
          ) : (
            "Hello"
          )}
        </AppText>
        <View className="flex-row items-center gap-1">
          <AppText variant="heading">Ano ulam mo</AppText>
          <Image
            key={reduceMotion ? "still" : "playing"}
            source={require("@/assets/today.gif")}
            style={{ width: 70, height: 30 }}
            contentFit="contain"
            autoplay={!reduceMotion}
          />
        </View>
      </View>
    </View>
  );
}

// Skips Home's re-renders (any route change re-renders Home, which reads
// its URL params), unless its own props change.
export const Header = memo(HeaderInner);
