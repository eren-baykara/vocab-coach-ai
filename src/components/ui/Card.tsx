import { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { theme } from "../../theme";

type CardProps = {
  children: ReactNode;
  variant?: "default" | "soft" | "primary";
  style?: ViewStyle;
};

export function Card({ children, variant = "default", style }: CardProps) {
  return <View style={[styles.base, styles[variant], style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    borderWidth: 1,
  },
  default: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
  },
  soft: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
  },
  primary: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
});
