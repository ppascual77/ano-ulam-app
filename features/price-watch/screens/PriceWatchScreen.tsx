import { View } from "react-native";
import { Screen, AppText } from "@/components/ui";
import { BottomNav } from "@/components/navigation/BottomNav";

export default function PriceWatchScreen() {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center">
        <AppText variant="title">Price Watch</AppText>
        <AppText variant="body" className="mt-1 text-center">
          Coming soon.
        </AppText>
      </View>
      <BottomNav />
    </Screen>
  );
}
