import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, DotMorphButton } from "@/frontend/components/ui";
import { RotatingBlob } from "../components/RotatingBlob";
import { startDotReveal } from "../components/DotReveal";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

// Get Started shrinks to an orange dot, which swells to fill the screen and
// opens onto onboarding (DotReveal).
const HANDOFF_MS = 50;

export default function IntroScreen() {
  const { isSignedIn } = useAuth();
  const reduceMotion = useReduceMotion();

  // app/_layout.tsx already waits for the initial session check before
  // rendering any screen, so by the time this mounts `isSignedIn` is settled —
  // skip the onboarding carousel entirely for a returning signed-in user.
  useEffect(() => {
    if (isSignedIn) {
      router.replace("/home");
    }
  }, [isSignedIn]);

  // The button's own dot hides once the overlay's has taken over from it.
  const [handedOff, setHandedOff] = useState(false);

  // Back from onboarding: a fresh button.
  const [run, setRun] = useState(0);
  const launched = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!launched.current) return;
      launched.current = false;
      setHandedOff(false);
      setRun((n) => n + 1);
    }, []),
  );

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

        <View className="mt-20" style={{ opacity: handedOff ? 0 : 1 }}>
          <DotMorphButton
            key={run}
            label="GET STARTED"
            shape="pill"
            reduceMotion={reduceMotion}
            onPress={() => {
              launched.current = true;
            }}
            onDone={(spot) => {
              if (!spot) {
                router.push("/onboarding");
                return;
              }
              startDotReveal(spot, () => router.push("/onboarding"));
              // A few frames later, once the overlay's dot is drawn over it,
              // so there's never a frame with no dot at all.
              setTimeout(() => setHandedOff(true), HANDOFF_MS);
            }}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
