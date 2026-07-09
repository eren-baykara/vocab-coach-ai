import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import {
  getCorrectionOptions,
  replaceUserWord,
  type PendingWordCorrection,
} from "./wordActions";
import { theme } from "../theme";

type WordCorrectionContextValue = {
  wordsChangeToken: number;
  queueCorrection: (correction: PendingWordCorrection) => void;
  notifyWordsChanged: () => void;
};

const WordCorrectionContext = createContext<WordCorrectionContextValue | null>(
  null
);

export function useWordCorrection() {
  const ctx = useContext(WordCorrectionContext);

  if (!ctx) {
    throw new Error(
      "useWordCorrection must be used within WordCorrectionProvider"
    );
  }

  return ctx;
}

export function WordCorrectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [pendingCorrection, setPendingCorrection] =
    useState<PendingWordCorrection | null>(null);
  const [applyingCorrection, setApplyingCorrection] = useState(false);
  const [wordsChangeToken, setWordsChangeToken] = useState(0);

  const bumpWordsChangeToken = useCallback(() => {
    setWordsChangeToken((value) => value + 1);
  }, []);

  const queueCorrection = useCallback((correction: PendingWordCorrection) => {
    setPendingCorrection(correction);
  }, []);

  async function applyCorrectionSuggestion(chosenWord: string) {
    if (!pendingCorrection) return;

    const cleanWord = chosenWord.trim();

    if (!cleanWord) return;

    setApplyingCorrection(true);

    await replaceUserWord(pendingCorrection.userWordId, cleanWord, {
      generateAi: pendingCorrection.generateAiAfterAdd,
      setId: pendingCorrection.setId,
      onAiComplete: bumpWordsChangeToken,
    });

    setApplyingCorrection(false);
    setPendingCorrection(null);
    bumpWordsChangeToken();
  }

  function keepOriginalWord() {
    if (!pendingCorrection || applyingCorrection) return;

    setPendingCorrection(null);
  }

  function cancelPendingCorrection() {
    if (applyingCorrection) return;

    setPendingCorrection(null);
  }

  const value = useMemo(
    () => ({
      wordsChangeToken,
      queueCorrection,
      notifyWordsChanged: bumpWordsChangeToken,
    }),
    [wordsChangeToken, queueCorrection, bumpWordsChangeToken]
  );

  return (
    <WordCorrectionContext.Provider value={value}>
      {children}

      <Modal
        visible={Boolean(pendingCorrection)}
        transparent
        animationType="fade"
        onRequestClose={cancelPendingCorrection}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>Yazım önerisi</Text>
            <Text style={styles.title}>
              Az önce eklediğin “{pendingCorrection?.originalWord}” kelimesinde
              yazım hatası olabilir.
            </Text>

            {pendingCorrection?.suggestion.reason_tr ? (
              <Text style={styles.reason}>
                {pendingCorrection.suggestion.reason_tr}
              </Text>
            ) : null}

            <Text style={styles.prompt}>Bunu mu demek istedin?</Text>

            <View style={styles.options}>
              {pendingCorrection
                ? getCorrectionOptions(
                    pendingCorrection.suggestion,
                    pendingCorrection.originalWord
                  ).map((option) => (
                    <Pressable
                      key={option}
                      style={styles.chip}
                      onPress={() => applyCorrectionSuggestion(option)}
                      disabled={applyingCorrection}
                    >
                      <Text style={styles.chipText}>
                        {applyingCorrection ? "Düzeltiliyor..." : option}
                      </Text>
                    </Pressable>
                  ))
                : null}
            </View>

            <Pressable
              style={[
                styles.asTypedButton,
                applyingCorrection && styles.disabledButton,
              ]}
              onPress={keepOriginalWord}
              disabled={applyingCorrection}
            >
              <Text style={styles.asTypedText}>
                {`"${pendingCorrection?.originalWord ?? ""}" yazdığım gibi kalsın`}
              </Text>
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={cancelPendingCorrection}
              disabled={applyingCorrection}
            >
              <Text style={styles.cancelText}>Kapat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </WordCorrectionContext.Provider>
  );
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
  eyebrow: {
    fontSize: 12,
    fontWeight: "900",
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 6,
  },
  reason: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: theme.colors.textMuted,
    marginBottom: 10,
  },
  prompt: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: 12,
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "900",
    color: theme.colors.textInverse,
  },
  asTypedButton: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  asTypedText: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  cancelButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "900",
    color: theme.colors.textSubtle,
  },
  disabledButton: {
    opacity: 0.55,
  },
});
