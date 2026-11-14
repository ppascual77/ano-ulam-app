import { Linking } from "react-native";

// Opens a web link that came from data (a post's link or caption, a price
// source), never from our own code. Only http(s): Linking.openURL would also
// happily open tel:, sms:, intent:// or another app's deep link, so anything
// else is ignored. The database only stores http(s) post links too
// (20261114010000_security_hardening); this covers old rows and admin data.
export function openWebUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return;
  void Linking.openURL(parsed.toString()).catch(() => {});
}
