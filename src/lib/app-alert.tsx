import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { theme } from "../theme";

export type AppAlertButton = {
  text?: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

type PendingAlert = {
  title: string;
  message?: string;
  buttons: AppAlertButton[];
};

type AppAlertContextValue = {
  showAlert: (
    title: string,
    message?: string,
    buttons?: AppAlertButton[]
  ) => void;
};

const AppAlertContext = createContext<AppAlertContextValue | null>(null);

let webAlertHandler:
  | ((title: string, message?: string, buttons?: AppAlertButton[]) => void)
  | null = null;

function resolveButtons(buttons?: AppAlertButton[]) {
  if (buttons && buttons.length > 0) {
    return buttons;
  }

  return [{ text: "Tamam", style: "default" as const }];
}

function runWebFallback(
  title: string,
  message?: string,
  buttons?: AppAlertButton[]
) {
  const resolvedButtons = resolveButtons(buttons);
  const body = [title, message].filter(Boolean).join("\n\n");

  if (resolvedButtons.length > 1) {
    const cancelButton =
      resolvedButtons.find((button) => button.style === "cancel") ??
      resolvedButtons[0];
    const actionButton =
      resolvedButtons.find((button) => button.style === "destructive") ??
      resolvedButtons.find((button) => button.style !== "cancel") ??
      resolvedButtons[resolvedButtons.length - 1];

    if (window.confirm(body)) {
      actionButton?.onPress?.();
      return;
    }

    cancelButton?.onPress?.();
    return;
  }

  window.alert(body);
  resolvedButtons[0]?.onPress?.();
}

export function appAlert(
  title: string,
  message?: string,
  buttons?: AppAlertButton[]
) {
  const resolvedButtons = resolveButtons(buttons);

  if (Platform.OS === "web") {
    if (webAlertHandler) {
      webAlertHandler(title, message, resolvedButtons);
      return;
    }

    runWebFallback(title, message, resolvedButtons);
    return;
  }

  Alert.alert(title, message, resolvedButtons);
}

function orderButtonsForWeb(buttons: AppAlertButton[]) {
  if (buttons.length <= 2) {
    const cancelButtons = buttons.filter((button) => button.style === "cancel");
    const actionButtons = buttons.filter((button) => button.style !== "cancel");

    return [...actionButtons, ...cancelButtons];
  }

  return buttons;
}

export function AppAlertProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<PendingAlert[]>([]);

  const currentAlert = queue[0] ?? null;

  const showAlert = useCallback(
    (title: string, message?: string, buttons?: AppAlertButton[]) => {
      setQueue((current) => [
        ...current,
        {
          title,
          message,
          buttons: resolveButtons(buttons),
        },
      ]);
    },
    []
  );

  const dismissCurrentAlert = useCallback((button?: AppAlertButton) => {
    button?.onPress?.();
    setQueue((current) => current.slice(1));
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") {
      webAlertHandler = null;
      return;
    }

    webAlertHandler = showAlert;

    return () => {
      webAlertHandler = null;
    };
  }, [showAlert]);

  const value = useMemo(() => ({ showAlert }), [showAlert]);

  return (
    <AppAlertContext.Provider value={value}>
      {children}

      {Platform.OS === "web" ? (
        <Modal
          visible={Boolean(currentAlert)}
          transparent
          animationType="fade"
          onRequestClose={() => {
            const cancelButton = currentAlert?.buttons.find(
              (button) => button.style === "cancel"
            );

            dismissCurrentAlert(cancelButton ?? currentAlert?.buttons[0]);
          }}
        >
          <View style={styles.overlay}>
            <View style={styles.card}>
              <Text style={styles.title}>{currentAlert?.title}</Text>

              {currentAlert?.message ? (
                <Text style={styles.message}>{currentAlert.message}</Text>
              ) : null}

              <View
                style={[
                  styles.actions,
                  (currentAlert?.buttons.length ?? 0) <= 2 && styles.actionsStacked,
                  (currentAlert?.buttons.length ?? 0) > 2 && styles.actionsStacked,
                ]}
              >
                {currentAlert
                  ? orderButtonsForWeb(currentAlert.buttons).map((button, index) => {
                  const isCancel = button.style === "cancel";
                  const isDestructive = button.style === "destructive";

                  return (
                    <Pressable
                      key={`${button.text ?? "button"}-${index}`}
                      style={[
                        styles.actionButton,
                        (currentAlert.buttons.length ?? 0) <= 2 &&
                          styles.actionButtonStacked,
                        (currentAlert.buttons.length ?? 0) > 2 &&
                          styles.actionButtonStacked,
                        isCancel && styles.cancelButton,
                        isDestructive && styles.destructiveButton,
                        !isCancel && !isDestructive && styles.primaryButton,
                      ]}
                      onPress={() => dismissCurrentAlert(button)}
                    >
                      <Text
                        style={[
                          styles.actionText,
                          isCancel && styles.cancelText,
                          isDestructive && styles.destructiveText,
                          !isCancel && !isDestructive && styles.primaryText,
                        ]}
                      >
                        {button.text ?? "Tamam"}
                      </Text>
                    </Pressable>
                  );
                })
                  : null}
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </AppAlertContext.Provider>
  );
}

export function useAppAlert() {
  const ctx = useContext(AppAlertContext);

  if (!ctx) {
    throw new Error("useAppAlert must be used within AppAlertProvider");
  }

  return ctx;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    ...theme.shadow.card,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: theme.colors.textMuted,
    marginBottom: 18,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "flex-end",
  },
  actionsStacked: {
    flexDirection: "column",
  },
  actionButton: {
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonStacked: {
    width: "100%",
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  cancelButton: {
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  destructiveButton: {
    backgroundColor: theme.colors.dangerSoft,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "900",
  },
  primaryText: {
    color: theme.colors.textInverse,
  },
  cancelText: {
    color: theme.colors.textMuted,
  },
  destructiveText: {
    color: theme.colors.dangerDark,
  },
});
