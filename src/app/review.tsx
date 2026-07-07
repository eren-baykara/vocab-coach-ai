import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";

import { supabase } from "../lib/supabase";

type ReviewRating = "again" | "good";

type WordContent = {
  display_word: string | null;
  simple_definition: string | null;
  turkish_meaning: string | null;
  toefl_example: string | null;
  daily_life_example: string | null;
  mini_lesson: string | null;
};

type ReviewWord = {
  id: string;
  status: string | null;
  personal_note: string | null;
  ease_factor: number | null;
  interval_days: number | null;
  repetition_count: number | null;
  lapse_count: number | null;
  next_review_at: string | null;
  last_reviewed_at: string | null;
  created_at: string;
  word_contents: WordContent | WordContent[] | null;
};

type QuizQuestion = {
  word: string;
  correctAnswer: string;
  simpleMeaning: string;
  example: string;
  options: string[];
};

const REVIEW_SELECT = `
  id,
  status,
  personal_note,
  ease_factor,
  interval_days,
  repetition_count,
  lapse_count,
  next_review_at,
  last_reviewed_at,
  created_at,
  word_contents (
    display_word,
    simple_definition,
    turkish_meaning,
    toefl_example,
    daily_life_example,
    mini_lesson
  )
`;

const FALLBACK_MEANINGS = [
  "genellikle",
  "nadiren",
  "geliştirmek",
  "karşılaştırmak",
  "açıklamak",
  "desteklemek",
  "azalmak",
  "artmak",
];

export default function ReviewScreen() {
  const params = useLocalSearchParams<{ setId?: string; setName?: string }>();
  const selectedSetId = typeof params.setId === "string" ? params.setId : null;
  const selectedSetName = typeof params.setName === "string" ? params.setName : null;

  const [loading, setLoading] = useState(true);
  const [savingResult, setSavingResult] = useState(false);

  const [practiceWords, setPracticeWords] = useState<ReviewWord[]>([]);
  const [allWords, setAllWords] = useState<ReviewWord[]>([]);
  const [initialCount, setInitialCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [lastWasCorrect, setLastWasCorrect] = useState<boolean | null>(null);

  const loadPracticeWords = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("user_words")
      .select(REVIEW_SELECT)
      .order("next_review_at", { ascending: true, nullsFirst: true });

    if (error) {
      setLoading(false);
      Alert.alert("Could not load practice", error.message);
      return;
    }

    let typedWords = ((data ?? []) as ReviewWord[]).filter(hasUsableMeaning);

    if (selectedSetId) {
      const { data: setItemsData, error: setItemsError } = await supabase
        .from("word_set_items")
        .select("user_word_id")
        .eq("set_id", selectedSetId);

      if (setItemsError) {
        setLoading(false);
        Alert.alert("Could not load set practice", setItemsError.message);
        return;
      }

      const setWordIds = new Set(
        (setItemsData ?? []).map((item) => item.user_word_id as string)
      );

      typedWords = typedWords.filter((item) => setWordIds.has(item.id));
    }

    const dueWords = typedWords.filter(isDue);
    const notDueWords = typedWords.filter((item) => !isDue(item));
    const orderedPracticeWords = [...dueWords, ...notDueWords].slice(0, 20);

    setAllWords(typedWords);
    setPracticeWords(orderedPracticeWords);
    setInitialCount(orderedPracticeWords.length);
    setCompletedCount(0);
    setSelectedAnswer(null);
    setLastWasCorrect(null);
    setLoading(false);
  }, [selectedSetId]);

  useEffect(() => {
    loadPracticeWords();
  }, [loadPracticeWords]);

  async function submitAnswer() {
    const currentWord = practiceWords[0];

    if (!currentWord || !selectedAnswer || !question) return;

    const isCorrect = selectedAnswer === question.correctAnswer;

    setLastWasCorrect(isCorrect);
    setSavingResult(true);

    const updatePayload = calculateReviewUpdate(
      currentWord,
      isCorrect ? "good" : "again"
    );

    const { error } = await supabase
      .from("user_words")
      .update(updatePayload)
      .eq("id", currentWord.id);

    setSavingResult(false);

    if (error) {
      Alert.alert("Could not save answer", error.message);
    }
  }

  function goToNextQuestion() {
    const currentWord = practiceWords[0];

    if (!currentWord) return;

    setCompletedCount((count) => count + 1);

    setPracticeWords((items) => {
      const remainingWords = items.slice(1);

      if (lastWasCorrect === false) {
        return [...remainingWords, currentWord];
      }

      return remainingWords;
    });

    setSelectedAnswer(null);
    setLastWasCorrect(null);
  }

  const currentWord = practiceWords[0];

  const question = useMemo(() => {
    if (!currentWord) return null;

    return buildQuizQuestion(currentWord, allWords);
  }, [currentWord, allWords]);

  const progressText =
    initialCount > 0
      ? `${completedCount} done • ${practiceWords.length} left`
      : "No practice words";

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <Stack.Screen options={{ title: "Practice" }} />
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading practice...</Text>
      </View>
    );
  }

  if (!currentWord || !question) {
    const completedSomething = completedCount > 0;

    return (
      <View style={styles.centeredContainer}>
        <Stack.Screen options={{ title: "Practice" }} />

        <Text style={styles.emptyTitle}>
          {completedSomething ? "Practice complete" : "No practice words yet"}
        </Text>

        <Text style={styles.emptyText}>
          {completedSomething
            ? `Nice work. You answered ${completedCount} question${
                completedCount === 1 ? "" : "s"
              }.`
            : selectedSetName
              ? `The "${selectedSetName}" set needs words with AI content first.`
              : "Add words and generate AI content first."}
        </Text>

        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Back home</Text>
        </Pressable>
      </View>
    );
  }

  const answerSubmitted = lastWasCorrect !== null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "Practice" }} />

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>‹ Back</Text>
      </Pressable>

      <View style={styles.progressCard}>
        <Text style={styles.progressText}>
          {selectedSetName ? `${selectedSetName} • ${progressText}` : progressText}
        </Text>
      </View>

      <View style={styles.quizCard}>
        <Text style={styles.quizEyebrow}>Meaning quiz</Text>
        <Text style={styles.questionText}>What does this word mean?</Text>
        <Text style={styles.wordTitle}>{question.word}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Choose the meaning</Text>

        <View style={styles.optionList}>
          {question.options.map((option) => {
            const isSelected = selectedAnswer === option;
            const isCorrect = option === question.correctAnswer;
            const showCorrect = answerSubmitted && isCorrect;
            const showWrong = answerSubmitted && isSelected && !isCorrect;

            return (
              <Pressable
                key={option}
                style={[
                  styles.optionButton,
                  isSelected && styles.selectedOption,
                  showCorrect && styles.correctOption,
                  showWrong && styles.wrongOption,
                ]}
                onPress={() => {
                  if (!answerSubmitted) {
                    setSelectedAnswer(option);
                  }
                }}
                disabled={answerSubmitted}
              >
                <Text
                  style={[
                    styles.optionText,
                    isSelected && styles.selectedOptionText,
                    showCorrect && styles.correctOptionText,
                    showWrong && styles.wrongOptionText,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!answerSubmitted ? (
          <Pressable
            style={[
              styles.button,
              (!selectedAnswer || savingResult) && styles.disabledButton,
            ]}
            onPress={submitAnswer}
            disabled={!selectedAnswer || savingResult}
          >
            <Text style={styles.buttonText}>
              {savingResult ? "Checking..." : "Check answer"}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.resultBox}>
            <Text
              style={[
                styles.resultTitle,
                lastWasCorrect ? styles.correctText : styles.wrongText,
              ]}
            >
              {lastWasCorrect ? "Correct" : "Not quite"}
            </Text>

            <Text style={styles.resultMeaning}>
              {question.word} = {question.correctAnswer}
            </Text>

            <View style={styles.resultBlock}>
              <Text style={styles.resultLabel}>Basit anlam</Text>
              <Text style={styles.resultText}>{question.simpleMeaning}</Text>
            </View>

            <View style={styles.resultBlock}>
              <Text style={styles.resultLabel}>Örnek cümle</Text>
              <Text style={styles.resultText}>{question.example}</Text>
            </View>

            <Pressable style={styles.button} onPress={goToNextQuestion}>
              <Text style={styles.buttonText}>Next question</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function hasUsableMeaning(item: ReviewWord) {
  const content = Array.isArray(item.word_contents)
    ? item.word_contents[0]
    : item.word_contents;

  return Boolean(content?.turkish_meaning || content?.simple_definition);
}

function isDue(item: ReviewWord) {
  if (!item.next_review_at) return true;

  return new Date(item.next_review_at) <= new Date();
}

function buildQuizQuestion(
  currentWord: ReviewWord,
  allWords: ReviewWord[]
): QuizQuestion {
  const currentContent = Array.isArray(currentWord.word_contents)
    ? currentWord.word_contents[0]
    : currentWord.word_contents;

  const correctAnswer =
    currentContent?.turkish_meaning ||
    currentContent?.simple_definition ||
    "Meaning has not been generated yet.";

  const otherMeanings = allWords
    .filter((item) => item.id !== currentWord.id)
    .map((item) => {
      const content = Array.isArray(item.word_contents)
        ? item.word_contents[0]
        : item.word_contents;

      return content?.turkish_meaning || content?.simple_definition || "";
    })
    .filter((item) => item.length > 0)
    .filter((item) => item !== correctAnswer);

  const combinedOptions = Array.from(
    new Set([correctAnswer, ...otherMeanings, ...FALLBACK_MEANINGS])
  ).slice(0, 4);

  const stableOptions = sortOptionsStable(combinedOptions, currentWord.id);

  return {
    word: currentContent?.display_word ?? "Untitled word",
    correctAnswer,
    simpleMeaning:
      currentContent?.simple_definition ||
      "Simple meaning has not been generated yet.",
    example:
      currentContent?.daily_life_example ||
      currentContent?.toefl_example ||
      "Example sentence has not been generated yet.",
    options: stableOptions,
  };
}

function sortOptionsStable(options: string[], seed: string) {
  return [...options].sort((a, b) => {
    const scoreA = stableScore(`${seed}-${a}`);
    const scoreB = stableScore(`${seed}-${b}`);

    return scoreA - scoreB;
  });
}

function stableScore(value: string) {
  return value.split("").reduce((total, char) => {
    return total + char.charCodeAt(0);
  }, 0);
}

function calculateReviewUpdate(word: ReviewWord, rating: ReviewRating) {
  const currentEase = word.ease_factor ?? 2.5;
  const currentInterval = word.interval_days ?? 0;
  const currentRepetitions = word.repetition_count ?? 0;
  const currentLapses = word.lapse_count ?? 0;

  let easeFactor = currentEase;
  let intervalDays = 1;
  let repetitionCount = currentRepetitions + 1;
  let lapseCount = currentLapses;
  let status = "learning";

  if (rating === "again") {
    easeFactor = Math.max(1.3, currentEase - 0.2);
    intervalDays = 1;
    repetitionCount = 0;
    lapseCount = currentLapses + 1;
    status = "learning";
  }

  if (rating === "good") {
    easeFactor = Math.min(3.0, currentEase + 0.05);

    if (currentRepetitions === 0) {
      intervalDays = 1;
    } else if (currentRepetitions === 1) {
      intervalDays = 3;
    } else {
      intervalDays = Math.max(3, Math.round(currentInterval * easeFactor));
    }

    status = intervalDays >= 7 ? "mastered" : "learning";
  }

  return {
    status,
    ease_factor: easeFactor,
    interval_days: intervalDays,
    repetition_count: repetitionCount,
    lapse_count: lapseCount,
    last_reviewed_at: new Date().toISOString(),
    next_review_at: getNextReviewDate(intervalDays),
  };
}

function getNextReviewDate(intervalDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + intervalDays);

  return date.toISOString();
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
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  progressText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#475569",
    textAlign: "center",
  },
  quizCard: {
    backgroundColor: "#2563eb",
    borderRadius: 28,
    padding: 26,
    marginBottom: 20,
    minHeight: 210,
    justifyContent: "center",
  },
  quizEyebrow: {
    fontSize: 13,
    fontWeight: "900",
    color: "#bfdbfe",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  questionText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#dbeafe",
    marginBottom: 10,
  },
  wordTitle: {
    fontSize: 44,
    fontWeight: "900",
    color: "#ffffff",
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
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 14,
  },
  optionList: {
    gap: 10,
    marginBottom: 16,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 16,
    backgroundColor: "#f8fafc",
  },
  selectedOption: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  correctOption: {
    borderColor: "#16a34a",
    backgroundColor: "#dcfce7",
  },
  wrongOption: {
    borderColor: "#dc2626",
    backgroundColor: "#fef2f2",
  },
  optionText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    lineHeight: 23,
  },
  selectedOptionText: {
    color: "#1d4ed8",
  },
  correctOptionText: {
    color: "#166534",
  },
  wrongOptionText: {
    color: "#991b1b",
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
    fontWeight: "900",
  },
  resultBox: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 16,
    marginTop: 4,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
  },
  correctText: {
    color: "#166534",
  },
  wrongText: {
    color: "#991b1b",
  },
  resultMeaning: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
    lineHeight: 28,
    marginBottom: 14,
  },
  resultBlock: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: "900",
    color: "#475569",
    marginBottom: 6,
  },
  resultText: {
    fontSize: 16,
    color: "#0f172a",
    lineHeight: 23,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 23,
    marginBottom: 20,
  },
  disabledButton: {
    opacity: 0.6,
  },
});
