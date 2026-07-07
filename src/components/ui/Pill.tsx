import { ReactNode } from "react";
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";

import { theme } from "../../theme";

type PillTone = "neutral" | "primary" | "success" | "warning" | "danger";

type PillProps = {
  children: ReactNode;
  tone?: PillTone;
  style?: ViewStyle;
};

const toneStyles: Record<PillTone, ViewStyle> = {
  neutral: {
    backgroundColor: theme.colors.surfaceSoft,
  },
  primary: {
    backgroundColor: theme.colors.primarySurface,
  },
  success: {
    backgroundColor: theme.colors.successSoft,
  },
  warning: {
    backgroundColor: theme.colors.warningSoft,
  },
  danger: {
    backgroundColor: theme.colors.dangerSoft,
  },
};

const textToneStyles: Record<PillTone, TextStyle> = {
  neutral: {
    color: theme.colors.textMuted,
  },
  primary: {
    color: theme.colors.primaryDark,
  },
  success: {
    color: theme.colors.successDark,
  },
  warning: {
    color: theme.colors.warningDark,
  },
  danger: {
    color: theme.colors.dangerDark,
  },
};

export function Pill({ children, tone = "neutral", style }: PillProps) {
  return (
    <View style={[styles.base, toneStyles[tone], style]}>
      <Text style={[styles.text, textToneStyles[tone]]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 7,
  },
  text: {
    fontSize: 12,
    fontWeight: "900",
  },
});
