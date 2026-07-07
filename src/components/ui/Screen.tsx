import { ReactNode } from "react";
import { ScrollView, View, StyleSheet, type ViewStyle } from "react-native";

import { theme } from "../../theme";

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
};

export function Screen({ children, scroll = true, style }: ScreenProps) {
  if (!scroll) {
    return <View style={[styles.container, style]}>{children}</View>;
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing["2xl"],
    paddingTop: 72,
    paddingBottom: theme.spacing["2xl"],
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing["2xl"],
    paddingTop: 72,
    paddingBottom: theme.spacing["3xl"],
  },
});
