import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";

import { supabase } from "../lib/supabase";
import { appAlert } from "../lib/app-alert";
import { theme } from "../theme";

type PracticeMode = "meaning" | "reverse" | "fill";
type ReviewRating = "again" | "good";

type WordContent = {
  display_word: string | null;
  simple_definition: string | null;
  turkish_meaning: string | null;
  toefl_example: string | null;
  toefl_example_tr: string | null;
  daily_life_example: string | null;
  daily_life_example_tr: string | null;
  fill_blank_sentence: string | null;
  fill_blank_sentence_tr: string | null;
  fill_blank_answer: string | null;
  meaning_distractors: string[] | null;
  word_distractors: string[] | null;
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
  ai_content_disabled: boolean | null;
  word_contents: WordContent | WordContent[] | null;
};

type QuizQuestion = {
  mode: PracticeMode;
  title: string;
  prompt: string;
  correctAnswer: string;
  meaning: string;
  simpleMeaning: string;
  example: string;
  exampleTr: string;
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
  ai_content_disabled,
  word_contents (
    display_word,
    simple_definition,
    turkish_meaning,
    toefl_example,
    daily_life_example,
    daily_life_example_tr,
    toefl_example_tr,
    fill_blank_sentence,
    fill_blank_sentence_tr,
    fill_blank_answer,
    meaning_distractors,
    word_distractors,
    mini_lesson
  )
`;

const MIN_OPTIONS_TO_SHOW_QUESTION = 2;

export default function ReviewScreen() {
  const params = useLocalSearchParams<{
    setId?: string;
    setName?: string;
    mode?: string;
  }>();

  const selectedSetId = typeof params.setId === "string" ? params.setId : null;
  const selectedSetName =
    typeof params.setName === "string" ? params.setName : null;

  const practiceMode = normalizePracticeMode(params.mode);

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
      appAlert("Pratik yüklenemedi", error.message);
      return;
    }

    let typedWords = ((data ?? []) as ReviewWord[]).filter((item) =>
      hasUsableContent(item, practiceMode)
    );

    if (selectedSetId) {
      const { data: setItemsData, error: setItemsError } = await supabase
        .from("word_set_items")
        .select("user_word_id")
        .eq("set_id", selectedSetId);

      if (setItemsError) {
        setLoading(false);
        appAlert("Set pratiği yüklenemedi", setItemsError.message);
        return;
      }

      const setWordIds = new Set(
        (setItemsData ?? []).map((item) => item.user_word_id as string)
      );

      typedWords = typedWords.filter((item) => setWordIds.has(item.id));
    }

    const dueWords = typedWords.filter(isDue);
    const orderedPracticeWords =
      dueWords.length > 0 ? dueWords.slice(0, 20) : typedWords.slice(0, 20);

    setAllWords(typedWords);
    setPracticeWords(orderedPracticeWords);
    setInitialCount(orderedPracticeWords.length);
    setCompletedCount(0);
    setSelectedAnswer(null);
    setLastWasCorrect(null);
    setLoading(false);
  }, [selectedSetId, practiceMode]);

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
      appAlert("Cevap kaydedilemedi", error.message);
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

    return buildQuizQuestion(currentWord, allWords, practiceMode);
  }, [currentWord, allWords, practiceMode]);

  useEffect(() => {
    if (question && question.options.length < MIN_OPTIONS_TO_SHOW_QUESTION) {
      goToNextQuestion();
    }
  }, [question]);

  const modeTitle = getModeTitle(practiceMode);

  const progressText =
    initialCount > 0
      ? `${completedCount} tamamlandı • ${practiceWords.length} kaldı`
      : "Pratik kelimesi yok";

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <Stack.Screen options={{ title: modeTitle }} />
        <ActivityIndicator />
        <Text style={styles.loadingText}>Sorular hazırlanıyor...</Text>
      </View>
    );
  }

  if (!currentWord || !question) {
    const completedSomething = completedCount > 0;

    return (
      <View style={styles.centeredContainer}>
        <Stack.Screen options={{ title: modeTitle }} />

        <Text style={styles.emptyTitle}>
          {completedSomething ? "Pratik tamamlandı" : "Henüz pratik kelimesi yok"}
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
          <Text style={styles.buttonText}>Geri dön</Text>
        </Pressable>
      </View>
    );
  }

  const answerSubmitted = lastWasCorrect !== null;
  const questionNumber = initialCount > 0 ? completedCount + 1 : 0;
  const progressPercent =
    initialCount > 0 ? Math.min((questionNumber / initialCount) * 100, 100) : 0;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <Text style={styles.iconButtonText}>‹</Text>
        </Pressable>

        <View style={styles.topTitleBlock}>
          <Text style={styles.modeTitle}>{modeTitle}</Text>
          <Text style={styles.scopeText} numberOfLines={1}>
            {selectedSetName ? selectedSetName : "Kelimelerim"}
          </Text>
        </View>

        <View style={styles.scorePill}>
          <Text style={styles.scorePillText}>
            {questionNumber}/{initialCount}
          </Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>

      <Text style={styles.progressText}>{progressText}</Text>

      <View style={styles.questionCard}>
        <View style={styles.questionHeader}>
          <Text style={styles.quizEyebrow}>{getChoiceSectionTitle(question.mode)}</Text>
          <View style={styles.aiPill}>
            <Text style={styles.aiPillText}>AI</Text>
          </View>
        </View>

        <Text style={styles.questionText}>{question.prompt}</Text>
        <Text style={styles.wordTitle}>{question.title}</Text>
      </View>

      <View style={styles.optionList}>
        {question.options.map((option, index) => {
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
              <View
                style={[
                  styles.optionIndex,
                  isSelected && styles.selectedOptionIndex,
                  showCorrect && styles.correctOptionIndex,
                  showWrong && styles.wrongOptionIndex,
                ]}
              >
                <Text
                  style={[
                    styles.optionIndexText,
                    isSelected && styles.selectedOptionIndexText,
                    showCorrect && styles.correctOptionIndexText,
                    showWrong && styles.wrongOptionIndexText,
                  ]}
                >
                  {showCorrect ? "✓" : showWrong ? "×" : String.fromCharCode(65 + index)}
                </Text>
              </View>

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

      {answerSubmitted ? (
        <View
          style={[
            styles.feedbackCard,
            lastWasCorrect ? styles.feedbackCorrect : styles.feedbackWrong,
          ]}
        >
          <Text
            style={[
              styles.feedbackTitle,
              lastWasCorrect ? styles.correctText : styles.wrongText,
            ]}
          >
            {lastWasCorrect ? "Doğru!" : "Tekrar bakalım"}
          </Text>

          <Text style={styles.feedbackAnswer}>
            Doğru cevap: {question.correctAnswer}
          </Text>

          <Text style={styles.feedbackMeaning}>{question.meaning}</Text>

          <View style={styles.exampleBox}>
            <Text style={styles.exampleLabel}>Örnek</Text>
            <Text style={styles.exampleText}>{question.example}</Text>
            {question.exampleTr ? (
              <Text style={styles.exampleTranslation}>{question.exampleTr}</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {!answerSubmitted ? (
        <Pressable
          style={[
            styles.primaryButton,
            (!selectedAnswer || savingResult) && styles.disabledButton,
          ]}
          onPress={submitAnswer}
          disabled={!selectedAnswer || savingResult}
        >
          <Text style={styles.primaryButtonText}>
            {savingResult ? "Kontrol ediliyor..." : "Cevabı Kontrol Et"}
          </Text>
        </Pressable>
      ) : (
        <Pressable style={styles.primaryButton} onPress={goToNextQuestion}>
          <Text style={styles.primaryButtonText}>Sonraki Soru →</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function normalizePracticeMode(value: string | string[] | undefined): PracticeMode {
  if (value === "reverse" || value === "fill" || value === "meaning") {
    return value;
  }

  return "meaning";
}

function getModeTitle(mode: PracticeMode) {
  if (mode === "reverse") return "Ters Test";
  if (mode === "fill") return "Boşluk Doldurma";

  return "Anlam Testi";
}

function getChoiceSectionTitle(mode: PracticeMode) {
  if (mode === "reverse") return "Doğru kelimeyi seç";
  if (mode === "fill") return "Eksik kelimeyi seç";

  return "Doğru anlamı seç";
}

function getContent(item: ReviewWord) {
  return Array.isArray(item.word_contents)
    ? item.word_contents[0]
    : item.word_contents;
}

function getWord(item: ReviewWord) {
  const content = getContent(item);

  return content?.display_word || "Untitled word";
}

function getMeaning(item: ReviewWord) {
  const content = getContent(item);

  return (
    content?.turkish_meaning ||
    content?.simple_definition ||
    "Meaning has not been generated yet."
  );
}

function getTurkishMeaning(item: ReviewWord) {
  const content = getContent(item);

  return content?.turkish_meaning ?? "";
}

function getSimpleMeaning(item: ReviewWord) {
  const content = getContent(item);

  return content?.simple_definition || "Simple meaning has not been generated yet.";
}

function getExample(item: ReviewWord) {
  const content = getContent(item);

  return (
    content?.daily_life_example ||
    content?.toefl_example ||
    "Example sentence has not been generated yet."
  );
}

function getExampleTr(item: ReviewWord) {
  const content = getContent(item);

  return (
    content?.daily_life_example_tr ||
    content?.toefl_example_tr ||
    "Türkçe çeviri henüz oluşturulmadı."
  );
}

function getMeaningDistractors(item: ReviewWord) {
  const content = getContent(item);

  return content?.meaning_distractors ?? [];
}

function getWordDistractors(item: ReviewWord) {
  const content = getContent(item);

  return content?.word_distractors ?? [];
}

function getFillBlankSentence(item: ReviewWord) {
  const content = getContent(item);

  return content?.fill_blank_sentence || getExample(item);
}

function getFillBlankSentenceTr(item: ReviewWord) {
  const content = getContent(item);

  return content?.fill_blank_sentence_tr || getExampleTr(item);
}

function getFillBlankAnswer(item: ReviewWord) {
  const content = getContent(item);

  return content?.fill_blank_answer || getWord(item);
}

function hasUsableContent(item: ReviewWord, mode: PracticeMode) {
  if (item.ai_content_disabled) return false;

  const content = getContent(item);

  if (!content?.display_word) return false;

  const hasTurkishMeaning = Boolean(content.turkish_meaning);
  const hasAnyMeaning = Boolean(content.turkish_meaning || content.simple_definition);

  if (mode === "meaning") {
    return hasTurkishMeaning;
  }

  if (mode === "fill") {
    return hasAnyMeaning && Boolean(
      content.fill_blank_sentence ||
        content.daily_life_example ||
        content.toefl_example
    );
  }

  return hasAnyMeaning;
}

function isDue(item: ReviewWord) {
  if (!item.next_review_at) return true;

  return new Date(item.next_review_at) <= new Date();
}

function buildQuizQuestion(
  currentWord: ReviewWord,
  allWords: ReviewWord[],
  mode: PracticeMode
): QuizQuestion {
  if (mode === "reverse") {
    return buildReverseQuestion(currentWord, allWords);
  }

  if (mode === "fill") {
    return buildFillQuestion(currentWord, allWords);
  }

  return buildMeaningQuestion(currentWord, allWords);
}

function buildMeaningQuestion(
  currentWord: ReviewWord,
  allWords: ReviewWord[]
): QuizQuestion {
  const fullMeaning = getTurkishMeaning(currentWord) || getMeaning(currentWord);
  const correctAnswer = cleanMeaningChoice(fullMeaning);

  const otherMeanings = allWords
    .filter((item) => item.id !== currentWord.id)
    .map((item) => cleanMeaningChoice(getTurkishMeaning(item)))
    .filter((item) => isUsableShortChoice(item, 6, 48))
    .filter((item) => item !== correctAnswer);

  const aiDistractors = getMeaningDistractors(currentWord)
    .map(cleanMeaningChoice)
    .filter((item) => isUsableShortChoice(item, 6, 48));

  const options = buildStableOptions(
    [correctAnswer, ...aiDistractors, ...otherMeanings],
    currentWord.id
  );

  return {
    mode: "meaning",
    title: getWord(currentWord),
    prompt: "What does this word mean?",
    correctAnswer,
    meaning: fullMeaning,
    simpleMeaning: getSimpleMeaning(currentWord),
    example: getExample(currentWord),
    exampleTr: getExampleTr(currentWord),
    options,
  };
}

function cleanMeaningChoice(value: string) {
  return normalizeOptionText(value)
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*\[[^\]]*\]/g, "")
    .split(/[;\n]/)[0]
    .replace(/[“”"]/g, "")
    .replace(/[.!?]+$/g, "")
    .trim();
}

function buildReverseQuestion(
  currentWord: ReviewWord,
  allWords: ReviewWord[]
): QuizQuestion {
  const correctAnswer = cleanWordChoice(getWord(currentWord));

  const otherWords = allWords
    .filter((item) => item.id !== currentWord.id)
    .map((item) => cleanWordChoice(getWord(item)))
    .filter((item) => isUsableShortChoice(item, 4, 36))
    .filter((item) => item !== correctAnswer);

  const aiDistractors = getWordDistractors(currentWord)
    .map(cleanWordChoice)
    .filter((item) => isUsableShortChoice(item, 4, 36));

  const options = buildStableOptions(
    [correctAnswer, ...aiDistractors, ...otherWords],
    currentWord.id
  );

  return {
    mode: "reverse",
    title: getMeaning(currentWord),
    prompt: "Which word matches this meaning?",
    correctAnswer,
    meaning: getMeaning(currentWord),
    simpleMeaning: getSimpleMeaning(currentWord),
    example: getExample(currentWord),
    exampleTr: getExampleTr(currentWord),
    options,
  };
}

function buildFillQuestion(
  currentWord: ReviewWord,
  allWords: ReviewWord[]
): QuizQuestion {
  const correctAnswer = cleanWordChoice(getFillBlankAnswer(currentWord));
  const example = getFillBlankSentence(currentWord);
  const blankedExample = createBlankedExample(example, correctAnswer);

  const otherWords = allWords
    .filter((item) => item.id !== currentWord.id)
    .map((item) => cleanWordChoice(getWord(item)))
    .filter((item) => isUsableShortChoice(item, 4, 36))
    .filter((item) => item !== correctAnswer);

  const aiDistractors = getWordDistractors(currentWord)
    .map(cleanWordChoice)
    .filter((item) => isUsableShortChoice(item, 4, 36));

  const options = buildStableOptions(
    [correctAnswer, ...aiDistractors, ...otherWords],
    currentWord.id
  );

  return {
    mode: "fill",
    title: blankedExample,
    prompt: "Choose the word that completes the sentence.",
    correctAnswer,
    meaning: getMeaning(currentWord),
    simpleMeaning: getSimpleMeaning(currentWord),
    example,
    exampleTr: getFillBlankSentenceTr(currentWord),
    options,
  };
}

function createBlankedExample(example: string, word: string) {
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exactRegex = new RegExp(`\\b${escapedWord}\\b`, "i");

  if (exactRegex.test(example)) {
    return example.replace(exactRegex, "_____");
  }

  return `${example}\n\nMissing word: _____`;
}

function cleanWordChoice(value: string) {
  return normalizeOptionText(value)
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*\[[^\]]*\]/g, "")
    .split(/[;,\n]/)[0]
    .replace(/[“”"]/g, "")
    .trim();
}

function normalizeOptionText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isUsableShortChoice(value: string, maxWords: number, maxChars: number) {
  const cleaned = normalizeOptionText(value);

  if (cleaned.length < 2) return false;
  if (cleaned.length > maxChars) return false;
  if (cleaned.split(" ").length > maxWords) return false;
  if (/[{}\[\]<>]/.test(cleaned)) return false;

  return true;
}

function buildStableOptions(values: string[], seed: string) {
  const uniqueValues: string[] = [];
  const seenValues = new Set<string>();

  values.forEach((value) => {
    const cleanValue = normalizeOptionText(value);
    const valueKey = cleanValue.toLowerCase();

    if (!cleanValue || seenValues.has(valueKey)) {
      return;
    }

    seenValues.add(valueKey);
    uniqueValues.push(cleanValue);
  });

  return sortOptionsStable(uniqueValues.slice(0, 4), seed);
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
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 28,
    backgroundColor: theme.colors.background,
  },
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.colors.textMuted,
    fontWeight: "700",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonText: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: "500",
    lineHeight: 34,
  },
  topTitleBlock: {
    flex: 1,
  },
  modeTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 2,
  },
  scopeText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  scorePill: {
    minWidth: 58,
    height: 38,
    borderRadius: 999,
    backgroundColor: theme.colors.primarySurface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  scorePillText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  progressTrack: {
    height: 7,
    backgroundColor: theme.colors.surfaceSoft,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 10,
  },
  progressFill: {
    height: "100%",
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
  },
  progressText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 16,
  },
  questionCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: 30,
    padding: 24,
    marginBottom: 18,
    minHeight: 210,
    justifyContent: "center",
    overflow: "hidden",
    ...theme.shadow.card,
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  quizEyebrow: {
    color: "#FFE7D8",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  aiPill: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  aiPillText: {
    color: theme.colors.textInverse,
    fontSize: 11,
    fontWeight: "900",
  },
  questionText: {
    color: "#FFE7D8",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 22,
    marginBottom: 10,
  },
  wordTitle: {
    color: theme.colors.textInverse,
    fontSize: 31,
    fontWeight: "900",
    lineHeight: 39,
    letterSpacing: -0.4,
  },
  optionList: {
    gap: 11,
    marginBottom: 16,
  },
  optionButton: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 13,
    ...theme.shadow.card,
  },
  selectedOption: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySurface,
  },
  correctOption: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.successSoft,
  },
  wrongOption: {
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.dangerSoft,
  },
  optionIndex: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedOptionIndex: {
    backgroundColor: theme.colors.primary,
  },
  correctOptionIndex: {
    backgroundColor: theme.colors.success,
  },
  wrongOptionIndex: {
    backgroundColor: theme.colors.danger,
  },
  optionIndexText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: "900",
  },
  selectedOptionIndexText: {
    color: theme.colors.textInverse,
  },
  correctOptionIndexText: {
    color: theme.colors.textInverse,
  },
  wrongOptionIndexText: {
    color: theme.colors.textInverse,
  },
  optionText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "900",
  },
  selectedOptionText: {
    color: theme.colors.primaryDark,
  },
  correctOptionText: {
    color: theme.colors.successDark,
  },
  wrongOptionText: {
    color: theme.colors.dangerDark,
  },
  primaryButton: {
    minHeight: 56,
    backgroundColor: theme.colors.primary,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 2,
    ...theme.shadow.card,
  },
  primaryButtonText: {
    color: theme.colors.textInverse,
    fontSize: 16,
    fontWeight: "900",
  },
  feedbackCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
  },
  feedbackCorrect: {
    backgroundColor: theme.colors.successSoft,
    borderColor: theme.colors.success,
  },
  feedbackWrong: {
    backgroundColor: theme.colors.dangerSoft,
    borderColor: theme.colors.danger,
  },
  feedbackTitle: {
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 6,
  },
  correctText: {
    color: theme.colors.successDark,
  },
  wrongText: {
    color: theme.colors.dangerDark,
  },
  feedbackAnswer: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 23,
    marginBottom: 8,
  },
  feedbackMeaning: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 12,
  },
  exampleBox: {
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: 16,
    padding: 14,
  },
  exampleLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  exampleText: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
  },
  exampleTranslation: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: "center",
    lineHeight: 23,
    marginBottom: 20,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  buttonText: {
    color: theme.colors.textInverse,
    fontSize: 16,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.55,
  },
});
