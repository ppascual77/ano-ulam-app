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
import { useReduceMotion, useReduceMotionStore } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { useSeenIntrosStore } from "@/frontend/core/preferences/store/useSeenIntrosStore";
import { DotHandoffOverlay, GlobalToast } from "@/frontend/components/ui";
import { AuthActivityOverlay } from "@/frontend/features/auth/components/AuthActivityOverlay";
import { GlobalLoginGate, PendingSaveReplay } from "@/frontend/features/auth/components/GlobalLoginGate";
import { RewardCelebration } from "@/frontend/core/pro/components/RewardCelebration";
import { usePushTokenSync } from "@/frontend/core/notifications/hooks/usePushPermission";
import { PushTapRouter } from "@/frontend/core/notifications/components/PushTapRouter";
import { SaveLimitSheet } from "@/frontend/core/saved/components/SaveLimitSheet";
import { SaveFeedbackLayer } from "@/frontend/core/saved/components/SaveFeedbackLayer";
import { noteTouch, useSaveFeedbackStore } from "@/frontend/core/saved/store/useSaveFeedbackStore";
import { useProStore } from "@/frontend/core/pro/store/useProStore";
import { useSurpriseMeStore } from "@/frontend/core/preferences/store/useSurpriseMeStore";
import { DotRevealOverlay } from "@/frontend/features/onboarding/components/DotReveal";

// Required for the Google sign-in browser-redirect flow's web fallback path;
// harmless no-op on native. https://supabase.com/docs/guides/auth/native-mobile-deep-linking
WebBrowser.maybeCompleteAuthSession();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Signed in with notifications allowed: this phone's push token stays
  // saved to the account (recipe approval pushes).
  usePushTokenSync();
  const [fontsLoaded, fontError] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Caveat_700Bold,
  });

  // Settings' "Reduce motion": loaded once here, read by each animation
  // that it shortens (useReduceMotion).
  const loadReduceMotion = useReduceMotionStore((s) => s.load);
  // The user's choice, else the phone's: what the dot handoff follows.
  const reduceMotionOn = useReduceMotion();
  // Settings' "Surprise me" (Home's pull-down tag), read by HomeScreen.
  const loadSurpriseMe = useSurpriseMeStore((s) => s.load);
  // Which page intros have played (each plays once).
  const loadSeenIntros = useSeenIntrosStore((s) => s.load);
  // Save feedback's Profile dot and how many hint toasts have shown.
  const loadSaveFeedback = useSaveFeedbackStore((s) => s.load);
  // The App Store subscription (RevenueCat), prices and trial eligibility.
  const loadPro = useProStore((s) => s.load);
  useEffect(() => {
    void loadReduceMotion();
    void loadSurpriseMe();
    void loadSeenIntros();
    void loadSaveFeedback();
    void loadPro();
  }, [loadReduceMotion, loadSurpriseMe, loadSeenIntros, loadSaveFeedback, loadPro]);

  const authLoading = useAuthStore((s) => s.loading);
  // Seen page intros follow the account: synced once the first session
  // check is done, and again on every sign-in or sign-out.
  const sessionUserId = useAuthStore((s) => s.session?.user.id ?? null);
  const syncSeenIntros = useSeenIntrosStore((s) => s.syncAccount);
  useEffect(() => {
    if (!authLoading) void syncSeenIntros(sessionUserId);
  }, [authLoading, sessionUserId, syncSeenIntros]);
  // Pro follows the account the same way (RevenueCat logs in as the user).
  const setProUser = useProStore((s) => s.setUser);
  useEffect(() => {
    if (!authLoading) void setProUser(sessionUserId);
  }, [authLoading, sessionUserId, setProUser]);
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
    // iPhone only (app.json supportsTablet: false): iPad runs it as an
    // iPhone app, scaled by iOS, so no letterbox here.
    <View style={{ flex: 1 }}>
      {/* onTouchStart sees every tap on its way down (it doesn't take the
          touch): a save flies from the tap that triggered it. */}
      <View style={{ flex: 1 }} onTouchStart={(e) => noteTouch(e.nativeEvent.pageX, e.nativeEvent.pageY)}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          {/* Reanimated never blanket-skips animations, even with the
              phone's reduce motion on: that froze everything (fades, skeleton
              pulses, nudges). Reduce motion is handled per animation instead
              (useReduceMotion): the big moves (page intros, the tab slide,
              numbers rolling) go, the small ones stay. */}
          <ReducedMotionConfig mode={ReduceMotion.Never} />
          <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
              <Stack screenOptions={{ headerShown: false }}>
                {/* Fades in (instead of sliding), so onboarding's page
                    indicator dot appears to stay put as Home's welcome
                    intro takes it over. */}
                <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
                {/* Swapped in under Get Started's orange dot while it fills
                    the screen (DotReveal), so no transition of its own. With
                    reduce motion there's no dot: a plain fade. */}
                <Stack.Screen name="onboarding" options={{ animation: reduceMotionOn ? "fade" : "none" }} />
                {/* The full Pro page slides up over whatever opened it. */}
                <Stack.Screen name="pro" options={{ presentation: "fullScreenModal" }} />
              </Stack>
              {/* Above every screen: a title dot flying to the next screen's. */}
              <DotHandoffOverlay enabled={!reduceMotionOn} />
              {/* Get Started's dot opening onto onboarding. */}
              <DotRevealOverlay />
              {/* A saved meal flying into the Profile tab. */}
              <SaveFeedbackLayer />
              {/* App-wide toasts (e.g. "Saved to your Profile"). */}
              <GlobalToast />
              {/* Full screen while a sign-in finishes or a log-out runs. */}
              {/* A guest's save (any screen): the login sheet, then the save. */}
              <GlobalLoginGate />
              {/* A free account saving past the cap: the Pro pitch. */}
              <SaveLimitSheet />
              <PendingSaveReplay />
              {/* A Pro reward landing (first photo post, first approved recipe). */}
              <RewardCelebration />
              {/* A tapped price push opens Price Watch. */}
              <PushTapRouter />
              <AuthActivityOverlay />
            </QueryClientProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </View>
    </View>
  );
}
