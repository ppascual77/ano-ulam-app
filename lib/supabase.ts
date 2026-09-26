import "react-native-get-random-values";

import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as aesjs from "aes-js";
import { AppState } from "react-native";

import type { Database } from "@/lib/database.types";

// expo-secure-store caps values at ~2048 bytes, too small for a full session object.
// Store the session in AsyncStorage encrypted with a key that itself lives in SecureStore.
// https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native
class LargeSecureStore {
  private async _encrypt(key: string, value: string) {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));

    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));

    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async _decrypt(key: string, value: string) {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) {
      return encryptionKeyHex;
    }

    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1)
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) {
      return encrypted;
    }

    return await this._decrypt(key, encrypted);
  }

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key: string, value: string) {
    const encrypted = await this._encrypt(key, value);

    await AsyncStorage.setItem(key, encrypted);
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// On non-browser platforms the refresh process runs continuously in the background
// unless tied to app foreground/background state.
// https://supabase.com/docs/reference/javascript/auth-startautorefresh
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

// supabase-js's error for a non-2xx Edge Function response is a generic
// "Edge Function returned a non-2xx status code" — it never reads the
// function's own {error: "..."} JSON body, so every failure (a bad URL,
// bot-protected site, OpenAI error, whatever) looked identical and
// undiagnosable from the app. This reads that body and throws its real
// message instead, falling back to the generic one only if the body isn't
// the JSON shape every Edge Function in this project returns on error.
export async function invokeEdgeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) {
    const context = (error as { context?: Response }).context;
    let detail: string | null = null;
    if (context && typeof context.json === "function") {
      try {
        const parsed = await context.clone().json();
        if (parsed?.error) detail = parsed.error;
      } catch {
        // body wasn't JSON (or already consumed) — fall back below
      }
    }
    throw new Error(detail ?? error.message);
  }
  if (!data) throw new Error(`${name} returned no data`);
  return data;
}
