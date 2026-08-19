import { View } from "react-native";
import { Screen, AppText, Button, Card } from "@/components/ui";

export default function HomeScreen() {
  return (
    <Screen className="items-center justify-center">
      <AppText variant="heading" className="text-center">
        AnoUlam
      </AppText>
      <AppText variant="caption" className="mt-2 mb-8 text-center">
        Kain nang tama, gastos nang sakto.
      </AppText>

      <Card className="w-full mb-6">
        <AppText variant="title">Today's suggestion</AppText>
        <AppText variant="body" className="mt-1">
          This card and the button below use the shared UI primitives from
          components/ui — swap this content for real screens as you build.
        </AppText>
      </Card>

      <View className="w-full">
        <Button label="Get started" variant="primary" />
      </View>
    </Screen>
  );
}
