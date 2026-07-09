import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL");
}

if (!supabasePublishableKey) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

// On web, Expo Router's static export pre-renders routes in Node.js, where
// `window` doesn't exist. AsyncStorage's web implementation reaches for
// `window.localStorage` as soon as Supabase auto-initializes auth, which
// crashes SSR with "window is not defined". Guard every call so it's a
// no-op during that pre-render pass, and behaves exactly like AsyncStorage
// once the client is actually running in a browser.
const storage =
  Platform.OS === "web"
    ? {
        getItem: (key: string) =>
          typeof window === "undefined"
            ? Promise.resolve(null)
            : AsyncStorage.getItem(key),
        setItem: (key: string, value: string) =>
          typeof window === "undefined"
            ? Promise.resolve()
            : AsyncStorage.setItem(key, value),
        removeItem: (key: string) =>
          typeof window === "undefined"
            ? Promise.resolve()
            : AsyncStorage.removeItem(key),
      }
    : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});