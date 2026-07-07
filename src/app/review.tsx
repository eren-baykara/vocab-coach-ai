import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, router } from "expo-router";

import { supabase } from "../lib/supabase";

type ReviewRating = "again" | "hard" | "good" | "easy";

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
  word_contents: WordContent | WordContent[] | null;
};

export default function ReviewScreen() {
  const [loading, setLoading] = useState(true);
  const [savingRating, setSavingRating] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const [reviewWords, setReviewWords] = useState<ReviewWord[]>([]);
  const [initialCount, setInitialCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  const loadReviewWords = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("user_words")
      .select(
        `
        id,
        status,
        personal_note,
        ease_factor,
        interval_days,
        repetition_count,
        lapse_count,
        next_review_at,
        last_reviewed_at,
        word_contents (
          display_word,
          simple_definition,
          turkish_meaning,
          toefl_example,
          daily_life_example,
          mini_lesson
        )
      `
      )
      .order("next_review_at", { ascending: true, nullsFirst: true });

    setLoading(false);

    if (error) {
      Alert.alert("Could not load review words", error.message);
      return;
    }

    const now = new Date();

    const dueWords = ((data ?? []) as ReviewWord[])
      .filter((item) => {
        if (!item.next_review_at) return true;

        return new Date(item.next_review_at) <= now;
      })
      .slice(0, 20);

    setReviewWords(dueWords);
    setInitialCount(dueWords.length);
    setCompletedCount(0);
    setShowAnswer(false);
  }, []);

  useEffect(() => {
    loadReviewWords();
  }, [loadReviewWords]);

  function getContent(item: ReviewWord) {
    return Array.isArray(item.word_contents)
      ? item.word_contents[0]
      : item.word_contents;
  }

  function renderValue(value: string | null | undefined) {
    if (!value) {
      return "Not generated yet";
    }

    return value;
  }

  function hasAiContent(item: ReviewWord) {
    const content = getContent(item);

    return Boolean(content?.simple_definition || content?.mini_lesson);
  }

  async function submitReview(rating: ReviewRating) {
    const currentWord = reviewWords[0];

    if (!currentWord) return;

    setSavingRating(true);

    const updatePayload = calculateReviewUpdate(currentWord, rating);

    const { error } = await supabase
      .from("user_words")
      .update(updatePayload)
      .eq("id", currentWord.id);

    setSavingRating(false);

    if (error) {
      Alert.alert("Could not save review", error.message);
      return;
    }

    setCompletedCount((count) => count + 1);

    setReviewWords((items) => {
      const remainingWords = items.slice(1);

      if (rating === "again" || rating === "hard") {
        return [...remainingWords, currentWord];
      }

      return remainingWords;
    });

    setShowAnswer(false);
  }

  const currentWord = reviewWords[0];
  const content = currentWord ? getContent(currentWord) : null;
  const progressText =
    initialCount > 0 ? `${completedCount}/${initialCount} reviewed` : "No due words";

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <Stack.Screen options={{ title: "Review" }} />
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading review session...</Text>
      </View>
    );
  }

  if (!currentWord || !content) {
    return (
      <View style={styles.centeredContainer}>
        <Stack.Screen options={{ title: "Review" }} />

        <Text style={styles.emptyTitle}>All caught up</Text>
        <Text style={styles.emptyText}>
          You do not have any due words right now. Add more words or come back
          after your next review date.
        </Text>

        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Back to words</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "Review" }} />

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>‹ Back</Text>
      </Pressable>

      <View style={styles.progressCard}>
        <Text style={styles.progressText}>{progressText}</Text>
      </View>

      <View style={styles.wordCard}>
        <Text style={styles.wordLabel}>Review this word</Text>
        <Text style={styles.wordTitle}>{content.display_word}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaBadge}>{currentWord.status ?? "new"}</Text>

          <Text
            style={[
              styles.metaBadge,
              hasAiContent(currentWord)
                ? styles.aiReadyBadge
                : styles.aiMissingBadge,
            ]}
          >
            {hasAiContent(currentWord) ? "AI ready" : "Needs AI"}
          </Text>
        </View>
      </View>

      {!showAnswer ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Do you know how to use it?</Text>
          <Text style={styles.helperText}>
            Try to remember the meaning, Turkish translation, and one example
            sentence before revealing the answer.
          </Text>

          <Pressable style={styles.button} onPress={() => setShowAnswer(true)}>
            <Text style={styles.buttonText}>Show answer</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Answer</Text>

            <InfoRow
              label="Simple definition"
              value={renderValue(content.simple_definition)}
            />

            <InfoRow
              label="Turkish meaning"
              value={renderValue(content.turkish_meaning)}
            />

            <InfoRow
              label="TOEFL / IELTS example"
              value={renderValue(content.toefl_example)}
            />

            <InfoRow
              label="Daily life example"
              value={renderValue(content.daily_life_example)}
            />

            <InfoRow label="Mini lesson" value={renderValue(content.mini_lesson)} />

            {currentWord.personal_note ? (
              <InfoRow label="Your note" value={currentWord.personal_note} />
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>How did it feel?</Text>

            <View style={styles.ratingList}>
              <RatingButton
                label="Again"
                description="I forgot it."
                disabled={savingRating}
                onPress={() => submitReview("again")}
              />

              <RatingButton
                label="Hard"
                description="I remembered with effort."
                disabled={savingRating}
                onPress={() => submitReview("hard")}
              />

              <RatingButton
                label="Good"
                description="I knew it."
                disabled={savingRating}
                onPress={() => submitReview("good")}
              />

              <RatingButton
                label="Easy"
                description="I knew it immediately."
                disabled={savingRating}
                onPress={() => submitReview("easy")}
              />
            </View>

            {savingRating ? (
              <Text style={styles.savingText}>Saving review...</Text>
            ) : null}
          </View>
        </>
      )}

      {!hasAiContent(currentWord) ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>AI content missing</Text>
          <Text style={styles.warningText}>
            This word is reviewable, but the lesson content is not generated yet.
          </Text>

          <Pressable
            style={styles.secondaryButton}
            onPress={() =>
              router.push({
                pathname: "/word/[id]",
                params: { id: currentWord.id },
              })
            }
          >
            <Text style={styles.secondaryButtonText}>Open word detail</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
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

  if (rating === "hard") {
    easeFactor = Math.max(1.3, currentEase - 0.15);
    intervalDays = Math.max(1, Math.round(currentInterval * 1.2) || 1);
    status = "learning";
  }

  if (rating === "good") {
    easeFactor = currentEase;

    if (currentRepetitions === 0) {
      intervalDays = 1;
    } else if (currentRepetitions === 1) {
      intervalDays = 3;
    } else {
      intervalDays = Math.max(3, Math.round(currentInterval * easeFactor));
    }

    status = intervalDays >= 7 ? "mastered" : "learning";
  }

  if (rating === "easy") {
    easeFactor = Math.min(3.0, currentEase + 0.15);

    if (currentRepetitions === 0) {
      intervalDays = 3;
    } else if (currentRepetitions === 1) {
      intervalDays = 7;
    } else {
      intervalDays = Math.max(
        7,
        Math.round(currentInterval * easeFactor * 1.3)
      );
    }

    status = "mastered";
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

type RatingButtonProps = {
  label: string;
  description: string;
  disabled: boolean;
  onPress: () => void;
};

function RatingButton({
  label,
  description,
  disabled,
  onPress,
}: RatingButtonProps) {
  return (
    <Pressable
      style={[styles.ratingButton, disabled && styles.disabledButton]}
      onPress={onPress}
      disabled={disabled}
    >
      <View>
        <Text style={styles.ratingTitle}>{label}</Text>
        <Text style={styles.ratingDescription}>{description}</Text>
      </View>

      <Text style={styles.ratingChevron}>›</Text>
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
    fontWeight: "700",
    color: "#475569",
    textAlign: "center",
  },
  wordCard: {
    backgroundColor: "#2563eb",
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
  },
  wordLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#bfdbfe",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  wordTitle: {
    fontSize: 38,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaBadge: {
    backgroundColor: "#dbeafe",
    color: "#1e3a8a",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: "hidden",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  aiReadyBadge: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  aiMissingBadge: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
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
    marginBottom: 14,
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
  ratingList: {
    gap: 10,
  },
  ratingButton: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#f8fafc",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ratingTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  ratingDescription: {
    fontSize: 14,
    color: "#64748b",
  },
  ratingChevron: {
    fontSize: 28,
    color: "#94a3b8",
  },
  savingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  warningCard: {
    backgroundColor: "#fef3c7",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#92400e",
    marginBottom: 8,
  },
  warningText: {
    fontSize: 15,
    color: "#92400e",
    lineHeight: 22,
    marginBottom: 14,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#92400e",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#92400e",
    fontSize: 16,
    fontWeight: "700",
  },
  emptyTitle: {
    fontSize: 26,
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
  disabledButton: {
    opacity: 0.6,
  },
});