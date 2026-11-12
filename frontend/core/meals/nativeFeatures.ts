import { NativeModules, TurboModuleRegistry } from "react-native";
import { requireOptionalNativeModule } from "expo";

// Native modules added after the current dev build (2026-11-13): expo-sharing
// and expo-keep-awake throw on import when their native side isn't in the
// build, so they're only loaded (lazily) once these checks pass. A build
// without them hides Share and skips keep-awake instead of crashing.

/** Share as an image needs both the capture (view-shot) and the share sheet. */
export const canShareImages =
  !!requireOptionalNativeModule("ExpoSharing") && !!(TurboModuleRegistry.get("RNViewShot") ?? NativeModules.RNViewShot);

export const canKeepAwake = !!requireOptionalNativeModule("ExpoKeepAwake");
