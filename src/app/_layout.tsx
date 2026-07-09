import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { WordCorrectionProvider } from "../lib/word-correction-context";
import { AppAlertProvider } from "../lib/app-alert";

export default function RootLayout() {
  return (
    <AppAlertProvider>
      <WordCorrectionProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </WordCorrectionProvider>
    </AppAlertProvider>
  );
}
