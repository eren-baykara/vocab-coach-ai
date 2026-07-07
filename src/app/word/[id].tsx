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

type WordSet = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type WordSetItem = {
  id: string;
  set_id: string;
  user_word_id: string;
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
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === "string" ? params.id : undefined;

  const [loading, setLoading] = useState(true);
  const [setsLoading, setSetsLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [savingSetChange, setSavingSetChange] = useState(false);

  const [wordDetail, setWordDetail] = useState<UserWordDetail | null>(null);
  const [personalNote, setPersonalNote] = useState("");
  const [sets, setSets] = useState<WordSet[]>([]);
  const [wordSetItems, setWordSetItems] = useState<WordSetItem[]>([]);

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

  const loadSetsForWord = useCallback(async () => {
    if (!id) return;

    setSetsLoading(true);

    const { data: setsData, error: setsError } = await supabase
      .from("word_sets")
      .select("id, name, description, created_at")
      .order("created_at", { ascending: true });

    if (setsError) {
      setSetsLoading(false);
      Alert.alert("Could not load sets", setsError.message);
      return;
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from("word_set_items")
      .select("id, set_id, user_word_id")
      .eq("user_word_id", id);

    setSetsLoading(false);

    if (itemsError) {
      Alert.alert("Could not load word sets", itemsError.message);
      return;
    }

    setSets((setsData ?? []) as WordSet[]);
    setWordSetItems((itemsData ?? []) as WordSetItem[]);
  }, [id]);

  useEffect(() => {
    loadWordDetail();
    loadSetsForWord();
  }, [loadWordDetail, loadSetsForWord]);

  function getContent() {
    if (!wordDetail) return null;

    return Array.isArray(wordDetail.word_contents)
      ? wordDetail.word_contents[0]
      : wordDetail.word_contents;
  }

  function hasAiContent(content: WordContent) {
    return Boolean(
      content.simple_definition ||
        content.turkish_meaning ||
        content.daily_life_example ||
        content.toefl_example ||
        content.mini_lesson
    );
  }

  function getPrimaryMeaning(content: WordContent) {
    return (
      content.turkish_meaning ||
      content.simple_definition ||
      "Anlam henüz oluşturulmadı."
    );
  }

  function getShortDefinition(content: WordContent) {
    return content.simple_definition || "Basit anlam henüz oluşturulmadı.";
  }

  function getExample(content: WordContent) {
    return (
      content.daily_life_example ||
      content.toefl_example ||
      "Örnek cümle henüz oluşturulmadı."
    );
  }

  function formatReviewDate(value: string | null) {
    if (!value) return "Henüz planlanmadı";

    const date = new Date(value);
    const now = new Date();

    if (date <= now) return "Şimdi tekrar edilebilir";

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getSetsForThisWord() {
    const setIds = new Set(wordSetItems.map((item) => item.set_id));

    return sets.filter((set) => setIds.has(set.id));
  }

  function getAvailableSetsForThisWord() {
    const setIds = new Set(wordSetItems.map((item) => item.set_id));

    return sets.filter((set) => !setIds.has(set.id));
  }

  async function addWordToSet(setId: string) {
    if (!id) return;

    setSavingSetChange(true);

    const { error } = await supabase.from("word_set_items").insert({
      set_id: setId,
      user_word_id: id,
    });

    setSavingSetChange(false);

    if (error && error.code !== "23505") {
      Alert.alert("Could not add to set", error.message);
      return;
    }

    await loadSetsForWord();
  }

  function confirmRemoveFromSet(set: WordSet) {
    Alert.alert(
      "Remove from set?",
      `Remove this word from "${set.name}"? The word will stay in Library.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeWordFromSet(set.id),
        },
      ]
    );
  }

  async function removeWordFromSet(setId: string) {
    if (!id) return;

    setSavingSetChange(true);

    const { error } = await supabase
      .from("word_set_items")
      .delete()
      .eq("set_id", setId)
      .eq("user_word_id", id);

    setSavingSetChange(false);

    if (error) {
      Alert.alert("Could not remove from set", error.message);
      return;
    }

    await loadSetsForWord();
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

    Alert.alert("Saved", "Your note has been saved.");
  }

  function confirmRemoveWord() {
    Alert.alert(
      "Remove word?",
      "This will remove the word from your Library and from every set. Shared AI content will stay in the database.",
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
  const currentSets = getSetsForThisWord();
  const availableSets = getAvailableSetsForThisWord();

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <Stack.Screen options={{ title: "Loading..." }} />
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading word...</Text>
      </View>
    );
  }

  if (!wordDetail || !content || !id) {
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
        <Text style={styles.heroLabel}>Kelime</Text>
        <Text style={styles.wordTitle}>{content.display_word}</Text>

        <View style={styles.badgeRow}>
          <Text style={styles.heroBadge}>{currentStatus}</Text>
          <Text
            style={[
              styles.heroBadge,
              aiReady ? styles.readyBadge : styles.needsBadge,
            ]}
          >
            {aiReady ? "Practice ready" : "Needs AI"}
          </Text>
        </View>
      </View>

      <View style={styles.meaningCard}>
        <Text style={styles.meaningLabel}>Anlam</Text>
        <Text style={styles.meaningText}>{getPrimaryMeaning(content)}</Text>

        <View style={styles.simpleBlock}>
          <Text style={styles.simpleLabel}>Basit anlam</Text>
          <Text style={styles.simpleText}>{getShortDefinition(content)}</Text>
        </View>

        <View style={styles.simpleBlock}>
          <Text style={styles.simpleLabel}>Örnek cümle</Text>
          <Text style={styles.simpleText}>{getExample(content)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Sets</Text>

          {setsLoading || savingSetChange ? (
            <Text style={styles.inlineLoadingText}>Updating...</Text>
          ) : null}
        </View>

        {currentSets.length === 0 ? (
          <View style={styles.libraryOnlyBox}>
            <Text style={styles.libraryOnlyTitle}>Library only</Text>
            <Text style={styles.libraryOnlyText}>
              This word is saved in your Library, but it is not inside a set yet.
            </Text>
          </View>
        ) : (
          <View style={styles.setMembershipList}>
            {currentSets.map((set) => (
              <View key={set.id} style={styles.setMembershipRow}>
                <View style={styles.setMembershipTextWrap}>
                  <Text style={styles.setMembershipTitle}>{set.name}</Text>
                  <Text style={styles.setMembershipMeta}>In this set</Text>
                </View>

                <Pressable
                  style={[
                    styles.removeSetButton,
                    savingSetChange && styles.disabledButton,
                  ]}
                  onPress={() => confirmRemoveFromSet(set)}
                  disabled={savingSetChange}
                >
                  <Text style={styles.removeSetButtonText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {availableSets.length > 0 ? (
          <View style={styles.addToSetBlock}>
            <Text style={styles.smallSectionTitle}>Add to another set</Text>

            <View style={styles.availableSetList}>
              {availableSets.map((set) => (
                <Pressable
                  key={set.id}
                  style={[
                    styles.addSetChip,
                    savingSetChange && styles.disabledButton,
                  ]}
                  onPress={() => addWordToSet(set.id)}
                  disabled={savingSetChange}
                >
                  <Text style={styles.addSetChipText}>+ {set.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : sets.length === 0 ? (
          <Text style={styles.helperText}>
            Create sets from Home first, then you can organize this word.
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Tekrar planı</Text>

        <View style={styles.scheduleRow}>
          <Text style={styles.scheduleLabel}>Sonraki tekrar</Text>
          <Text style={styles.scheduleValue}>
            {formatReviewDate(wordDetail.next_review_at)}
          </Text>
        </View>

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
        <Text style={styles.sectionTitle}>Kişisel not</Text>

        <TextInput
          style={styles.noteInput}
          placeholder="Kendi hafıza ipucun, çevirin veya örneğin..."
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
        <Text style={styles.sectionTitle}>AI içeriği</Text>

        <Text style={styles.helperText}>
          AI içeriği anlamları, örnekleri, quizleri ve pratik ekranlarını besler.
        </Text>

        {aiReady ? (
          <Text style={styles.successText}>AI içeriği hazır.</Text>
        ) : (
          <Text style={styles.warningText}>
            Gelişmiş pratikten önce AI içeriği üret.
          </Text>
        )}

        <Pressable
          style={[styles.button, generatingAi && styles.disabledButton]}
          onPress={generateAiLesson}
          disabled={generatingAi}
        >
          <Text style={styles.buttonText}>
            {generatingAi
              ? "Generating..."
              : aiReady
                ? "AI içeriğini kontrol et"
                : "AI üret"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.dangerCard}>
        <Text style={styles.dangerTitle}>Library’den çıkar</Text>
        <Text style={styles.dangerText}>
          Bu işlem kelimeyi Library’den ve bağlı olduğu tüm setlerden çıkarır.
        </Text>

        <Pressable
          style={[styles.dangerButton, deleting && styles.disabledButton]}
          onPress={confirmRemoveWord}
          disabled={deleting}
        >
          <Text style={styles.dangerButtonText}>
            {deleting ? "Removing..." : "Kelimeyi çıkar"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
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
    fontWeight: "800",
    color: "#2563eb",
  },
  heroCard: {
    backgroundColor: "#2563eb",
    borderRadius: 28,
    padding: 26,
    marginBottom: 18,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: "#bfdbfe",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  wordTitle: {
    fontSize: 42,
    fontWeight: "900",
    color: "#ffffff",
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroBadge: {
    backgroundColor: "#dbeafe",
    color: "#1e3a8a",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    overflow: "hidden",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  readyBadge: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  needsBadge: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
  meaningCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 22,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  meaningLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: "#2563eb",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  meaningText: {
    fontSize: 26,
    fontWeight: "900",
    color: "#0f172a",
    lineHeight: 34,
    marginBottom: 18,
  },
  simpleBlock: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 14,
    marginTop: 14,
  },
  simpleLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#475569",
    marginBottom: 6,
  },
  simpleText: {
    fontSize: 16,
    color: "#0f172a",
    lineHeight: 24,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 10,
  },
  inlineLoadingText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "800",
  },
  libraryOnlyBox: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  libraryOnlyTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 4,
  },
  libraryOnlyText: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
  },
  setMembershipList: {
    gap: 10,
    marginBottom: 14,
  },
  setMembershipRow: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  setMembershipTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  setMembershipTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 4,
  },
  setMembershipMeta: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
  },
  removeSetButton: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  removeSetButtonText: {
    color: "#991b1b",
    fontSize: 13,
    fontWeight: "900",
  },
  addToSetBlock: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 14,
  },
  smallSectionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#475569",
    marginBottom: 10,
  },
  availableSetList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  addSetChip: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  addSetChipText: {
    color: "#1d4ed8",
    fontSize: 14,
    fontWeight: "900",
  },
  helperText: {
    fontSize: 15,
    color: "#64748b",
    lineHeight: 22,
    marginBottom: 14,
  },
  scheduleRow: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  scheduleLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#64748b",
    marginBottom: 4,
  },
  scheduleValue: {
    fontSize: 17,
    fontWeight: "900",
    color: "#0f172a",
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
    fontWeight: "800",
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
    minHeight: 110,
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
  successText: {
    fontSize: 15,
    color: "#166534",
    backgroundColor: "#dcfce7",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    fontWeight: "700",
  },
  warningText: {
    fontSize: 15,
    color: "#92400e",
    backgroundColor: "#fef3c7",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    fontWeight: "700",
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "900",
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
    fontWeight: "800",
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
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.6,
  },
});
