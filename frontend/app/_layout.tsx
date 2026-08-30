import "../../global.css";

import { useEffect, useCallback } from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
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

import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/frontend/features/auth/store/useAuthStore";

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
  });

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
