import * as WebBrowser from "expo-web-browser";

// The Privacy Policy and Terms of Service live on anoulam.app, one text for
// the website and the app (the App Store listing links the same pages).
// Opened in an in-app browser sheet, so the app never ships a copy that can
// fall out of date.
export const PRIVACY_URL = "https://anoulam.app/privacy";
export const TERMS_URL = "https://anoulam.app/terms";

export const openPrivacyPolicy = () => void WebBrowser.openBrowserAsync(PRIVACY_URL).catch(() => {});
export const openTerms = () => void WebBrowser.openBrowserAsync(TERMS_URL).catch(() => {});
