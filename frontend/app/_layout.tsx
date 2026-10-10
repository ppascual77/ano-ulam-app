import "../../global.css";

import { useEffect, useCallback } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ReducedMotionConfig, ReduceMotion } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import * as WebBrowser from "expo-web-browser";
import { useFonts } from "expo-font";
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
// Scoped exception to "one family, whole app" — just for RandomMealPuller's
// handwritten "Surprise me" paper tag, not general app typography.
import { Caveat_700Bold } from "@expo-google-fonts/caveat";

import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/frontend/features/auth/store/useAuthStore";
import { useReduceMotionStore } from "@/frontend/core/preferences/store/useReduceMotionStore";

// Required for the Google sign-in browser-redirect flow's web fallback path;
// harmless no-op on native. https://supabase.com/docs/guides/auth/native-mobile-deep-linking
WebBrowser.maybeCompleteAuthSession();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Caveat_700Bold,
  });

  // Settings' "Reduce motion": loaded once here, then applied app-wide below.
  const reduceMotion = useReduceMotionStore((s) => s.override);
  const loadReduceMotion = useReduceMotionStore((s) => s.load);
  useEffect(() => {
    void loadReduceMotion();
  }, [loadReduceMotion]);

  const authLoading = useAuthStore((s) => s.loading);
  const setSession = useAuthStore((s) => s.setSession);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.subscription.unsubscribe();
  }, [setSession, setLoading]);

  const onLayoutRootView = useCallback(async () => {
    if ((fontsLoaded || fontError) && !authLoading) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, authLoading]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  if ((!fontsLoaded && !fontError) || authLoading) {
    return null;
  }

  return (
    // TEMP: no iPad-specific layout designed yet — letterbox to a phone-sized
    // box (like Instagram on iPad) instead of stretching, bars on all sides.
    // Remove once a real tablet layout exists. 430x932 matches the largest
    // current iPhone (Pro Max); not themeable values, so not in
    // constants/theme.ts.
    <View style={{ flex: 1, backgroundColor: "black", alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: "100%", maxWidth: 430, height: "100%", maxHeight: 932 }}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          {/* Every Reanimated animation jumps straight to its end when
              reduced: the user's choice, else the phone's setting. */}
          <ReducedMotionConfig
            mode={reduceMotion == null ? ReduceMotion.System : reduceMotion ? ReduceMotion.Always : ReduceMotion.Never}
          />
          <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
              <Stack screenOptions={{ headerShown: false }} />
            </QueryClientProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </View>
    </View>
  );
}
