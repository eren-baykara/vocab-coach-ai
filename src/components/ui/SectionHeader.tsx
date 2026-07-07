import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { theme } from "../../theme";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  right?: ReactNode;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  right,
}: SectionHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.textWrap}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>

      {right ? <View>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  textWrap: {
    flex: 1,
  },
  eyebrow: {
    ...theme.typography.eyebrow,
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },
  title: {
    ...theme.typography.sectionTitle,
    color: theme.colors.text,
  },
  description: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  },
});
