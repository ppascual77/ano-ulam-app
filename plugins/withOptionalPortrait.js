// "orientation": "portrait" in app.json makes Android treat a portrait
// screen as a required hardware feature (android.hardware.screen.portrait),
// so Google Play hides the app from tablets, foldables, Chromebooks and XR
// devices and now refuses to send a release for review over it. This marks
// the feature optional: the app still runs portrait-only, it just no longer
// refuses to install on devices that can't guarantee a portrait screen.
const { withAndroidManifest } = require("expo/config-plugins");

const FEATURE = "android.hardware.screen.portrait";

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const features = manifest["uses-feature"] ?? [];
    const existing = features.find((f) => f.$?.["android:name"] === FEATURE);
    if (existing) existing.$["android:required"] = "false";
    else features.push({ $: { "android:name": FEATURE, "android:required": "false" } });
    manifest["uses-feature"] = features;
    return cfg;
  });
};
