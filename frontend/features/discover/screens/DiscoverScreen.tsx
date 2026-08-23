import { View } from "react-native";
import { Screen, AppText } from "@/frontend/components/ui";

export default function DiscoverScreen() {
  return (
    <Screen edges={["top"]}>
      <View className="flex-1 items-center justify-center">
        <AppText variant="title">Discover</AppText>
        <AppText variant="body" className="mt-1 text-center">
          Coming soon.
        </AppText>
      </View>
    </Screen>
  );
}
