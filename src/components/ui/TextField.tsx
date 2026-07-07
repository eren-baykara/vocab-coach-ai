import { StyleSheet, TextInput, type TextInputProps } from "react-native";

import { theme } from "../../theme";

export function TextField(props: TextInputProps) {
  return (
    <TextInput
      {...props}
      placeholderTextColor={theme.colors.textSubtle}
      style={[styles.input, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 52,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.text,
  },
});
