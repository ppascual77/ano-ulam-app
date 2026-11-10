import { memo, type ReactNode } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { AppText } from "@/frontend/components/ui";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

type HeaderProps = {
  /** Undefined/guest shows the greeting only, no name. */
  name?: string;
  /** Under the greeting (Home's live price line). */
  children?: ReactNode;
};

// Filipino greeting by the phone's time of day.
export function greetingNow(date = new Date()): string {
  const h = date.getHours();
  if (h >= 4 && h < 11) return "Magandang umaga";
  if (h >= 11 && h < 13) return "Magandang tanghali";
  if (h >= 13 && h < 18) return "Magandang hapon";
  return "Magandang gabi";
}

// The avatar (and the admin menu) moved to the bottom nav's Profile tab.
// White text: it sits on HomeBackdrop's dark green.
function HeaderInner({ name, children }: HeaderProps) {
  // Reduce motion: the "today?" GIF holds still on its first frame.
  // `autoplay` only applies when the image loads, and Home stays mounted
  // while the setting changes, so the key reloads it either way.
  const reduceMotion = useReduceMotion();
  return (
    <View className="ml-2 flex-row items-center justify-between">
      <View>
        <AppText variant="title" className="text-white">
          {greetingNow()}
          {name ? (
            <>
              , <Text className="font-inter-bold text-home-name">{name}</Text>
            </>
          ) : null}
        </AppText>
        <View className="flex-row items-center gap-1">
          <AppText variant="heading" className="text-white">Ano ulam mo</AppText>
          <Image
            key={reduceMotion ? "still" : "playing"}
            source={require("@/assets/today.gif")}
            style={{ width: 70, height: 30 }}
            contentFit="contain"
            autoplay={!reduceMotion}
          />
        </View>
        {children}
      </View>
    </View>
  );
}

// Skips Home's re-renders (any route change re-renders Home, which reads
// its URL params), unless its own props change.
export const Header = memo(HeaderInner);
