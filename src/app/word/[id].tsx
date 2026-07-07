import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";

import { supabase } from "../../lib/supabase";

type WordStatus = "new" | "learning" | "mastered";

type WordContent = {
  display_word: string | null;
  normalized_word: string | null;
  simple_definition: string | null;
  academic_definition: string | null;
  turkish_meaning: string | null;
  toefl_example: string | null;
  daily_life_example: string | null;
  synonyms: string[] | null;
  antonyms: string[] | null;
  collocations: string[] | null;
  common_mistake: string | null;
  mnemonic: string | null;
  mini_lesson: string | null;
  cefr_level: string | null;
  difficulty_level: number | null;
};

type UserWordDetail = {
  id: string;
  status: string | null;
  personal_note: string | null;
  created_at: string;
  next_review_at: string | null;
  last_reviewed_at: string | null;
  word_contents: WordContent | WordContent[] | null;
};

const WORD_DETAIL_SELECT = `
  id,
  status,
  personal_note,
  created_at,
  next_review_at,
  last_reviewed_at,
  word_contents (
    display_word,
    normalized_word,
    simple_definition,
    academic_definition,
    turkish_meaning,
    toefl_example,
    daily_life_example,
    synonyms,
    antonyms,
    collocations,
    common_mistake,
    mnemonic,
    mini_lesson,
    cefr_level,
    difficulty_level
  )
`;

export default function WordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);

  const [wordDetail, setWordDetail] = useState<UserWordDetail | null>(null);
  const [personalNote, setPersonalNote] = useState("");

  const loadWordDetail = useCallback(async () => {
    if (!id) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("user_words")
      .select(WORD_DETAIL_SELECT)
      .eq("id", id)
      .single();

    setLoading(false);

    if (error) {
      Alert.alert("Could not load word", error.message);
      return;
    }

    const typedData = data as UserWordDetail;

    setWordDetail(typedData);
    setPersonalNote(typedData.personal_note ?? "");
  }, [id]);

  useEffect(() => {
    loadWordDetail();
  }, [loadWordDetail]);

  function getContent() {
    if (!wordDetail) return null;

    return Array.isArray(wordDetail.word_contents)
      ? wordDetail.word_contents[0]
      : wordDetail.word_contents;
  }

  function hasAiContent(content: WordContent) {
    return Boolean(
      content.simple_definition ||
        content.academic_definition ||
        content.turkish_meaning ||
        content.mini_lesson
    );
  }

  function renderTextValue(value: string | number | null | undefined) {
    if (value === null || value === undefined || value === "") {
      return "Not generated yet";
    }

    return String(value);
  }

  function renderListValue(value: string[] | null | undefined) {
    if (!value || value.length === 0) {
      return "Not generated yet";
    }

    return value.join(", ");
  }

  async function generateAiLesson() {
    if (!id || !wordDetail) return;

    setGeneratingAi(true);

    const { data, error } = await supabase.functions.invoke(
      "generate-word-content",
      {
        body: {
          user_word_id: id,
        },
      }
    );

    setGeneratingAi(false);

    if (error) {
      const detailedMessage = await getFunctionErrorMessage(error);

      Alert.alert("Could not generate AI lesson", detailedMessage);
      return;
    }

    await loadWordDetail();

    if (data?.cached) {
      Alert.alert("Already generated", "This word already has AI content.");
      return;
    }

    Alert.alert("AI lesson ready", "Your word content has been generated.");
  }
  async function getFunctionErrorMessage(error: unknown) {
    const fallbackMessage =
      error instanceof Error ? error.message : "Unknown function error";

    const maybeError = error as {
      context?: Response;
    };

    if (!maybeError.context) {
      return fallbackMessage;
    }

    try {
      const responseText = await maybeError.context.text();

      if (!responseText) {
        return fallbackMessage;
      }

      try {
        const parsed = JSON.parse(responseText);

        if (parsed?.error) {
          return String(parsed.error);
        }

        return responseText;
      } catch {
        return responseText;
      }
    } catch {
      return fallbackMessage;
    }
  }
  async function updateWordStatus(newStatus: WordStatus) {
    if (!id || !wordDetail) return;

    setSavingStatus(true);

    const { data, error } = await supabase
      .from("user_words")
      .update({
        status: newStatus,
      })
      .eq("id", id)
      .select(WORD_DETAIL_SELECT)
      .single();

    setSavingStatus(false);

    if (error) {
      Alert.alert("Could not update status", error.message);
      return;
    }

    setWordDetail(data as UserWordDetail);
  }

  async function savePersonalNote() {
    if (!id || !wordDetail) return;

    setSavingNote(true);

    const cleanNote = personalNote.trim();

    const { data, error } = await supabase
      .from("user_words")
      .update({
        personal_note: cleanNote.length > 0 ? cleanNote : null,
      })
      .eq("id", id)
      .select(WORD_DETAIL_SELECT)
      .single();

    setSavingNote(false);

    if (error) {
      Alert.alert("Could not save note", error.message);
      return;
    }

    const typedData = data as UserWordDetail;

    setWordDetail(typedData);
    setPersonalNote(typedData.personal_note ?? "");

    Alert.alert("Saved", "Your personal note has been saved.");
  }

  function confirmRemoveWord() {
    Alert.alert(
      "Remove word?",
      "This will remove the word from your personal list. The shared word content will stay in the database.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: removeWord,
        },
      ]
    );
  }

  async function removeWord() {
    if (!id) return;

    setDeleting(true);

    const { error } = await supabase.from("user_words").delete().eq("id", id);

    setDeleting(false);

    if (error) {
      Alert.alert("Could not remove word", error.message);
      return;
    }

    router.back();
  }

  const content = getContent();
  const title = content?.display_word ?? "Word detail";
  const currentStatus = (wordDetail?.status ?? "new") as WordStatus;
  const aiReady = content ? hasAiContent(content) : false;

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <Stack.Screen options={{ title: "Loading..." }} />
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading word detail...</Text>
      </View>
    );
  }

  if (!wordDetail || !content) {
    return (
      <View style={styles.centeredContainer}>
        <Stack.Screen options={{ title: "Word not found" }} />
        <Text style={styles.emptyTitle}>Word not found</Text>
        <Text style={styles.emptyText}>
          This word could not be loaded. It may have been removed.
        </Text>

        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title }} />

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>‹ Back</Text>
      </Pressable>

      <View style={styles.heroCard}>
        <Text style={styles.wordTitle}>{content.display_word}</Text>
        <Text style={styles.wordMeta}>Status: {currentStatus}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>AI lesson</Text>

        <Text style={styles.helperText}>
          Generate definitions, examples, Turkish meaning, collocations, common
          mistakes, and a mini lesson for this word.
        </Text>

        {aiReady ? (
          <Text style={styles.successText}>AI content is ready.</Text>
        ) : (
          <Text style={styles.warningText}>
            AI content has not been generated yet.
          </Text>
        )}

        <Pressable
          style={[styles.button, generatingAi && styles.disabledButton]}
          onPress={generateAiLesson}
          disabled={generatingAi}
        >
          <Text style={styles.buttonText}>
            {generatingAi ? "Generating..." : "Generate AI lesson"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Review status</Text>

        <Text style={styles.helperText}>
          Track how well you know this word. This is the first step toward a
          review system.
        </Text>

        <View style={styles.statusActions}>
          <StatusButton
            label="New"
            active={currentStatus === "new"}
            disabled={savingStatus}
            onPress={() => updateWordStatus("new")}
          />

          <StatusButton
            label="Learning"
            active={currentStatus === "learning"}
            disabled={savingStatus}
            onPress={() => updateWordStatus("learning")}
          />

          <StatusButton
            label="Mastered"
            active={currentStatus === "mastered"}
            disabled={savingStatus}
            onPress={() => updateWordStatus("mastered")}
          />
        </View>

        {savingStatus ? (
          <Text style={styles.savingText}>Updating status...</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Personal note</Text>

        <Text style={styles.helperText}>
          Add your own memory trick, translation, example, or reminder for this
          word.
        </Text>

        <TextInput
          style={styles.noteInput}
          placeholder="Example: I saw this word in a reading passage about climate change."
          multiline
          value={personalNote}
          onChangeText={setPersonalNote}
          editable={!savingNote}
          textAlignVertical="top"
        />

        <Pressable
          style={[styles.button, savingNote && styles.disabledButton]}
          onPress={savePersonalNote}
          disabled={savingNote}
        >
          <Text style={styles.buttonText}>
            {savingNote ? "Saving..." : "Save note"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Meaning</Text>

        <InfoRow
          label="Simple definition"
          value={renderTextValue(content.simple_definition)}
        />

        <InfoRow
          label="Academic definition"
          value={renderTextValue(content.academic_definition)}
        />

        <InfoRow
          label="Turkish meaning"
          value={renderTextValue(content.turkish_meaning)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Examples</Text>

        <InfoRow
          label="TOEFL / IELTS example"
          value={renderTextValue(content.toefl_example)}
        />

        <InfoRow
          label="Daily life example"
          value={renderTextValue(content.daily_life_example)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Usage</Text>

        <InfoRow label="Synonyms" value={renderListValue(content.synonyms)} />

        <InfoRow label="Antonyms" value={renderListValue(content.antonyms)} />

        <InfoRow
          label="Collocations"
          value={renderListValue(content.collocations)}
        />

        <InfoRow
          label="Common mistake"
          value={renderTextValue(content.common_mistake)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Learning</Text>

        <InfoRow label="Mnemonic" value={renderTextValue(content.mnemonic)} />

        <InfoRow
          label="Mini lesson"
          value={renderTextValue(content.mini_lesson)}
        />

        <InfoRow label="CEFR level" value={renderTextValue(content.cefr_level)} />

        <InfoRow
          label="Difficulty"
          value={renderTextValue(content.difficulty_level)}
        />
      </View>

      <View style={styles.dangerCard}>
        <Text style={styles.dangerTitle}>Remove from my words</Text>
        <Text style={styles.dangerText}>
          This only removes the word from your personal vocabulary list.
        </Text>

        <Pressable
          style={[styles.dangerButton, deleting && styles.disabledButton]}
          onPress={confirmRemoveWord}
          disabled={deleting}
        >
          <Text style={styles.dangerButtonText}>
            {deleting ? "Removing..." : "Remove word"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
};

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

type StatusButtonProps = {
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
};

function StatusButton({ label, active, disabled, onPress }: StatusButtonProps) {
  return (
    <Pressable
      style={[
        styles.statusButton,
        active && styles.activeStatusButton,
        disabled && styles.disabledButton,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        style={[
          styles.statusButtonText,
          active && styles.activeStatusButtonText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#475569",
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2563eb",
  },
  heroCard: {
    backgroundColor: "#2563eb",
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
  },
  wordTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 8,
  },
  wordMeta: {
    fontSize: 16,
    color: "#dbeafe",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 14,
  },
  helperText: {
    fontSize: 15,
    color: "#64748b",
    lineHeight: 22,
    marginBottom: 12,
  },
  successText: {
    fontSize: 15,
    color: "#166534",
    backgroundColor: "#dcfce7",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 15,
    color: "#92400e",
    backgroundColor: "#fef3c7",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  statusActions: {
    gap: 10,
  },
  statusButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  activeStatusButton: {
    borderColor: "#2563eb",
    backgroundColor: "#dbeafe",
  },
  statusButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#475569",
  },
  activeStatusButtonText: {
    color: "#1d4ed8",
  },
  savingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  noteInput: {
    minHeight: 120,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#0f172a",
    lineHeight: 22,
    marginBottom: 12,
  },
  infoRow: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 14,
    marginTop: 14,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 16,
    color: "#0f172a",
    lineHeight: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  dangerCard: {
    backgroundColor: "#fef2f2",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  dangerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#991b1b",
    marginBottom: 8,
  },
  dangerText: {
    fontSize: 15,
    color: "#7f1d1d",
    lineHeight: 22,
    marginBottom: 14,
  },
  dangerButton: {
    backgroundColor: "#dc2626",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  dangerButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
});