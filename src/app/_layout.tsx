import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { WordCorrectionProvider } from "../lib/word-correction-context";

export default function RootLayout() {
  return (
    <WordCorrectionProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </WordCorrectionProvider>
  );
}
