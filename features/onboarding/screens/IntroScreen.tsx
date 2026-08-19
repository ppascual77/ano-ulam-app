import { View, Text } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Button } from "@/components/ui";
import { RotatingBlob } from "../components/RotatingBlob";

export default function IntroScreen() {
  return (
    <View style={{ flex: 1 }} className="bg-white">
      <View className="absolute inset-0">
        <RotatingBlob
          source={require("@/assets/onboarding/blob-bg/circular-blob.png")}
          aspectRatio={1800 / 1755}
          top="-110%"
          height={2000}
        />
        <RotatingBlob
          source={require("@/assets/onboarding/blob-bg/circular-blob.png")}
          aspectRatio={1800 / 1755}
          bottom="-110%"
          height={2000}
        />
      </View>
      <SafeAreaView
        edges={["top", "bottom"]}
        style={{ flex: 1 }}
        className="justify-center mx-10"
      >
        <View className="w-full items-center mb-8">
          <Image
            source={require("@/assets/onboarding/intro.gif")}
            style={{ width: 255, height: 306 }}
            contentFit="contain"
          />
        </View>

        <AppText variant="eyebrow" className="mb-5">
          Never run out of ulam ideas
        </AppText>

        <Text className="font-inter-extrabold text-hero">
          <Text className="text-primary">Ano</Text>
          <Text className="text-accent">Ulam </Text>
          {"\n"}
          <Text className="text-ink-emphasis">mo</Text>
          {"\n"}
          <Text className="text-ink-emphasis">today?</Text>
        </Text>

        <View className="mt-20">
          <Button
            label="GET STARTED"
            variant="primary"
            shape="pill"
            onPress={() => router.push("/onboarding")}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
