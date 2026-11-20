import { Linking } from "react-native";
import * as Clipboard from "expo-clipboard";

// Opens the phone's mail app on a new email to `address`. With no mail app
// set up (Android without one, an iPhone with Mail deleted) openURL fails;
// then the address is copied so the person can paste it into any app.
// "copied" means the caller should say so; "failed" means even that failed.
export async function openEmail(address: string, subject?: string): Promise<"opened" | "copied" | "failed"> {
  const url = `mailto:${address}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
  try {
    await Linking.openURL(url);
    return "opened";
  } catch {
    try {
      await Clipboard.setStringAsync(address);
      return "copied";
    } catch {
      return "failed";
    }
  }
}

/** The toast for a result that isn't "opened" (null when it opened). */
export const emailFallbackMessage = (result: "opened" | "copied" | "failed", address: string): string | null =>
  result === "opened" ? null : result === "copied" ? `No email app found. Copied ${address} so you can email us from any app.` : `Email us at ${address}.`;
