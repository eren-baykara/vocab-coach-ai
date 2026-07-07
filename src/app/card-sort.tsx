import { useCallback, useEffect, useMemo, useState } from "react";
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

import { supabase } from "../lib/supabase";

type WordContent = {
  display_word: string | null;
  normalized_word: string | null;
  simple_definition: string | null;
  turkish_meaning: string | null;
  toefl_example: string | null;
  toefl_example_tr: string | null;
  daily_life_example: string | null;
  daily_life_example_tr: string | null;
  mini_lesson: string | null;
};

type SortWord = {
  id: string;
  status: string | null;
  created_at: string;
  next_review_at: string | null;
  word_contents: WordContent | WordContent[] | null;
};

const CARD_SORT_SELECT = `
  id,
  status,
  created_at,
  next_review_at,
  word_contents (
    display_word,
    normalized_word,
    simple_definition,
    turkish_meaning,
    toefl_example,
    toefl_example_tr,
    daily_life_example,
    daily_life_example_tr,
    mini_lesson
  )
`;

export default function CardSortScreen() {
  const params = useLocalSearchParams<{
    setId?: string;
    setName?: string;
  }>();

  const selectedSetId = typeof params.setId === "string" ? params.setId : null;
  const selectedSetName =
    typeof params.setName === "string" ? params.setName : null;

  const [loading, setLoading] = useState(true);
  const [savingChoice, setSavingChoice] = useState(false);
  const [creatingSet, setCreatingSet] = useState(false);

  const [words, setWords] = useState<SortWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const [knownWordIds, setKnownWordIds] = useState<string[]>([]);
  const [learningWordIds, setLearningWordIds] = useState<string[]>([]);
  const [newSetName, setNewSetName] = useState(
    selectedSetName ? `${selectedSetName} - Still Learning` : "Still Learning"
  );

  const loadWords = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("user_words")
      .select(CARD_SORT_SELECT)
      .order("created_at", { ascending: false });

    if (error) {
      setLoading(false);
      Alert.alert("Could not load card sort", error.message);
      return;
    }

    let typedWords = ((data ?? []) as SortWord[]).filter((item) =>
      Boolean(getDisplayWord(item))
    );

    if (selectedSetId) {
      const { data: setItemsData, error: setItemsError } = await supabase
        .from("word_set_items")
        .select("user_word_id")
        .eq("set_id", selectedSetId);

      if (setItemsError) {
        setLoading(false);
        Alert.alert("Could not load set words", setItemsError.message);
        return;
      }

      const setWordIds = new Set(
        (setItemsData ?? []).map((item) => item.user_word_id as string)
      );

      typedWords = typedWords.filter((item) => setWordIds.has(item.id));
    }

    const learningFirst = [...typedWords].sort((a, b) => {
      const scoreA = getSortPriority(a);
      const scoreB = getSortPriority(b);

      if (scoreA !== scoreB) return scoreA - scoreB;

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setWords(learningFirst);
    setCurrentIndex(0);
    setRevealed(false);
    setKnownWordIds([]);
    setLearningWordIds([]);
    setLoading(false);
  }, [selectedSetId]);

  useEffect(() => {
    loadWords();
  }, [loadWords]);

  const currentWord = words[currentIndex];
  const complete = !loading && words.length > 0 && currentIndex >= words.length;
  const progressText =
    words.length > 0
      ? `${Math.min(currentIndex + 1, words.length)} / ${words.length}`
      : "No words";

  const scopeTitle = selectedSetName ?? "Library";
  const currentContent = currentWord ? getContent(currentWord) : null;

  const knownCount = knownWordIds.length;
  const learningCount = learningWordIds.length;

  const canCreateLearningSet = learningWordIds.length > 0 && newSetName.trim();

  async function markCurrentWord(choice: "known" | "learning") {
    if (!currentWord || savingChoice) return;

    setSavingChoice(true);

    const updatePayload =
      choice === "known"
        ? buildKnownUpdate()
        : buildLearningUpdate();

    const { error } = await supabase
      .from("user_words")
      .update(updatePayload)
      .eq("id", currentWord.id);

    setSavingChoice(false);

    if (error) {
      Alert.alert("Could not save choice", error.message);
      return;
    }

    if (choice === "known") {
      setKnownWordIds((ids) => addUnique(ids, currentWord.id));
    } else {
      setLearningWordIds((ids) => addUnique(ids, currentWord.id));
    }

    setCurrentIndex((index) => index + 1);
    setRevealed(false);
  }

  async function createStillLearningSet() {
    const cleanName = newSetName.trim();

    if (!cleanName || learningWordIds.length === 0) return null;

    setCreatingSet(true);

    const { data: setData, error: setError } = await supabase
      .from("word_sets")
      .insert({
        name: cleanName,
      })
      .select("id, name, description, created_at")
      .single();

    if (setError) {
      setCreatingSet(false);
      Alert.alert("Could not create set", setError.message);
      return null;
    }

    const rows = learningWordIds.map((wordId) => ({
      set_id: setData.id,
      user_word_id: wordId,
    }));

    const { error: itemsError } = await supabase.from("word_set_items").insert(rows);

    setCreatingSet(false);

    if (itemsError) {
      Alert.alert("Set created, but words could not be added", itemsError.message);
      return null;
    }

    return setData as { id: string; name: string };
  }

  async function createLearningSet() {
    const createdSet = await createStillLearningSet();

    if (!createdSet) return;

    Alert.alert(
      "Set created",
      `"${createdSet.name}" now has ${learningWordIds.length} word${
        learningWordIds.length === 1 ? "" : "s"
      }.`
    );
  }

  async function createLearningSetAndPractice() {
    const createdSet = await createStillLearningSet();

    if (!createdSet) return;

    router.replace({
      pathname: "/review",
      params: {
        setId: createdSet.id,
        setName: createdSet.name,
        mode: "meaning",
      },
    });
  }

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <Stack.Screen options={{ title: "Card Sort" }} />
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading cards...</Text>
      </View>
    );
  }

  if (words.length === 0) {
    return (
      <View style={styles.centeredContainer}>
        <Stack.Screen options={{ title: "Card Sort" }} />

        <Text style={styles.emptyTitle}>No words to sort</Text>
        <Text style={styles.emptyText}>
          {selectedSetName
            ? `The "${selectedSetName}" set is empty. Add words first.`
            : "Add words to your Library first."}
        </Text>

        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Back home</Text>
        </Pressable>
      </View>
    );
  }

  if (complete) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Stack.Screen options={{ title: "Card Sort Complete" }} />

        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>‹ Back</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>{scopeTitle}</Text>
          <Text style={styles.title}>Card sort complete</Text>
          <Text style={styles.subtitle}>
            You separated what you know from what still needs practice.
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statNumber}>{knownCount}</Text>
              <Text style={styles.statLabel}>known</Text>
            </View>

            <View style={styles.statPill}>
              <Text style={styles.statNumber}>{learningCount}</Text>
              <Text style={styles.statLabel}>still learning</Text>
            </View>
          </View>
        </View>

        {learningWordIds.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Create a focused set</Text>
            <Text style={styles.helperText}>
              Save the words you marked as still learning into a new set.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Set name"
              value={newSetName}
              onChangeText={setNewSetName}
              editable={!creatingSet}
            />

            <Pressable
              style={[
                styles.button,
                (!canCreateLearningSet || creatingSet) && styles.disabledButton,
              ]}
              onPress={createLearningSet}
              disabled={!canCreateLearningSet || creatingSet}
            >
              <Text style={styles.buttonText}>
                {creatingSet ? "Creating..." : "Create Still Learning set"}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.secondaryButton,
                (!canCreateLearningSet || creatingSet) && styles.disabledButton,
              ]}
              onPress={createLearningSetAndPractice}
              disabled={!canCreateLearningSet || creatingSet}
            >
              <Text style={styles.secondaryButtonText}>
                Create set and practice
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Nice work</Text>
            <Text style={styles.helperText}>
              You marked every card as known. These words will come back later,
              not immediately.
            </Text>
          </View>
        )}

        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Back home</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "Card Sort" }} />

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>‹ Back</Text>
      </Pressable>

      <View style={styles.progressCard}>
        <Text style={styles.progressText}>
          {scopeTitle} • {progressText}
        </Text>
      </View>

      <Pressable
        style={styles.wordCard}
        onPress={() => setRevealed((value) => !value)}
      >
        <Text style={styles.cardHint}>
          {revealed ? "Tap to hide" : "Tap to reveal meaning"}
        </Text>

        <Text style={styles.wordTitle}>{getDisplayWord(currentWord)}</Text>

        {revealed ? (
          <View style={styles.revealBlock}>
            <Text style={styles.meaningLabel}>Meaning</Text>
            <Text style={styles.meaningText}>{getMeaning(currentWord)}</Text>

            {getExample(currentWord) ? (
              <View style={styles.exampleBlock}>
                <Text style={styles.meaningLabel}>Example</Text>
                <Text style={styles.exampleText}>{getExample(currentWord)}</Text>

                {getExampleTr(currentWord) ? (
                  <Text style={styles.exampleTranslation}>
                    {getExampleTr(currentWord)}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {!hasAiContent(currentContent) ? (
              <Text style={styles.warningText}>
                AI content is missing. You can still sort this word, then generate
                AI content from word detail later.
              </Text>
            ) : null}
          </View>
        ) : null}
      </Pressable>

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.learningButton, savingChoice && styles.disabledButton]}
          onPress={() => markCurrentWord("learning")}
          disabled={savingChoice}
        >
          <Text style={styles.learningButtonText}>← Keep learning</Text>
        </Pressable>

        <Pressable
          style={[styles.knownButton, savingChoice && styles.disabledButton]}
          onPress={() => markCurrentWord("known")}
          disabled={savingChoice}
        >
          <Text style={styles.knownButtonText}>I know this →</Text>
        </Pressable>
      </View>

      <Text style={styles.footerHint}>
        Known words are moved farther out. Still learning words stay close for
        practice.
      </Text>
    </ScrollView>
  );
}

function getContent(item: SortWord) {
  return Array.isArray(item.word_contents)
    ? item.word_contents[0]
    : item.word_contents;
}

function getDisplayWord(item: SortWord) {
  const content = getContent(item);

  return content?.display_word || content?.normalized_word || "Untitled word";
}

function getMeaning(item: SortWord) {
  const content = getContent(item);

  return (
    content?.turkish_meaning ||
    content?.simple_definition ||
    "Meaning has not been generated yet."
  );
}

function getExample(item: SortWord) {
  const content = getContent(item);

  return content?.daily_life_example || content?.toefl_example || "";
}

function getExampleTr(item: SortWord) {
  const content = getContent(item);

  return content?.daily_life_example_tr || content?.toefl_example_tr || "";
}

function hasAiContent(content: WordContent | null) {
  return Boolean(
    content?.turkish_meaning ||
      content?.simple_definition ||
      content?.daily_life_example ||
      content?.toefl_example ||
      content?.mini_lesson
  );
}

function getSortPriority(item: SortWord) {
  if (item.status === "learning") return 0;
  if (item.status === "new" || !item.status) return 1;
  if (isDue(item)) return 2;

  return 3;
}

function isDue(item: SortWord) {
  if (!item.next_review_at) return true;

  return new Date(item.next_review_at) <= new Date();
}

function buildKnownUpdate() {
  return {
    status: "mastered",
    interval_days: 30,
    repetition_count: 1,
    last_reviewed_at: new Date().toISOString(),
    next_review_at: getNextReviewDate(30),
  };
}

function buildLearningUpdate() {
  return {
    status: "learning",
    interval_days: 1,
    repetition_count: 0,
    last_reviewed_at: new Date().toISOString(),
    next_review_at: getNextReviewDate(1),
  };
}

function getNextReviewDate(intervalDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + intervalDays);

  return date.toISOString();
}

function addUnique(values: string[], nextValue: string) {
  if (values.includes(nextValue)) return values;

  return [...values, nextValue];
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
  progressCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#e0f2fe",
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#075985",
  },
  card: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  wordCard: {
    minHeight: 360,
    padding: 24,
    borderRadius: 32,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    justifyContent: "center",
    marginBottom: 18,
  },
  cardHint: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 20,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  wordTitle: {
    textAlign: "center",
    fontSize: 42,
    fontWeight: "900",
    color: "#0f172a",
  },
  revealBlock: {
    marginTop: 28,
    paddingTop: 22,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    gap: 12,
  },
  meaningLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  meaningText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
  },
  exampleBlock: {
    marginTop: 8,
    gap: 8,
  },
  exampleText: {
    fontSize: 17,
    lineHeight: 25,
    color: "#334155",
  },
  exampleTranslation: {
    fontSize: 15,
    lineHeight: 22,
    color: "#64748b",
  },
  warningText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: "#92400e",
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  learningButton: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    alignItems: "center",
  },
  learningButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#c2410c",
  },
  knownButton: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    alignItems: "center",
  },
  knownButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#047857",
  },
  disabledButton: {
    opacity: 0.55,
  },
  footerHint: {
    marginTop: 14,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    color: "#64748b",
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "900",
    color: "#2563eb",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: "#475569",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  statPill: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0f172a",
  },
  statLabel: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 8,
  },
  helperText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#475569",
    marginBottom: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#ffffff",
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  secondaryButton: {
    marginTop: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "#e0f2fe",
  },
  secondaryButtonText: {
    color: "#075985",
    fontSize: 16,
    fontWeight: "900",
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#475569",
    textAlign: "center",
    marginBottom: 18,
  },
});
