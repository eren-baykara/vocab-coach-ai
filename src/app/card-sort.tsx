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

import { supabase } from "../lib/supabase";
import { theme } from "../theme";

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
    daily_life_example_tr,
    daily_life_example,
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
  const [feedback, setFeedback] = useState<"known" | "learning" | null>(null);

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
      Alert.alert("Kartlar yüklenemedi", error.message);
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
        Alert.alert("Set kelimeleri yüklenemedi", setItemsError.message);
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
    setFeedback(null);
    setKnownWordIds([]);
    setLearningWordIds([]);
    setLoading(false);
  }, [selectedSetId]);

  useEffect(() => {
    loadWords();
  }, [loadWords]);

  const currentWord = words[currentIndex];
  const complete = !loading && words.length > 0 && currentIndex >= words.length;
  const scopeTitle = selectedSetName ?? "Kelimelerim";
  const currentContent = currentWord ? getContent(currentWord) : null;

  const knownCount = knownWordIds.length;
  const learningCount = learningWordIds.length;
  const canCreateLearningSet =
    learningWordIds.length > 0 && newSetName.trim().length > 0;

  const currentCardNumber =
    words.length > 0 ? Math.min(currentIndex + 1, words.length) : 0;
  const progressPercent =
    words.length > 0 ? (currentCardNumber / words.length) * 100 : 0;

  async function markCurrentWord(choice: "known" | "learning") {
    if (!currentWord || savingChoice || feedback) return;

    setSavingChoice(true);

    const updatePayload =
      choice === "known" ? buildKnownUpdate() : buildLearningUpdate();

    const { error } = await supabase
      .from("user_words")
      .update(updatePayload)
      .eq("id", currentWord.id);

    setSavingChoice(false);

    if (error) {
      Alert.alert("Seçim kaydedilemedi", error.message);
      return;
    }

    if (choice === "known") {
      setKnownWordIds((ids) => addUnique(ids, currentWord.id));
    } else {
      setLearningWordIds((ids) => addUnique(ids, currentWord.id));
    }

    setFeedback(choice);

    setTimeout(() => {
      setCurrentIndex((index) => index + 1);
      setRevealed(false);
      setFeedback(null);
    }, 520);
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
      Alert.alert("Set oluşturulamadı", setError.message);
      return null;
    }

    const rows = learningWordIds.map((wordId) => ({
      set_id: setData.id,
      user_word_id: wordId,
    }));

    const { error: itemsError } = await supabase.from("word_set_items").insert(rows);

    setCreatingSet(false);

    if (itemsError) {
      Alert.alert("Set oluşturuldu ama kelimeler eklenemedi", itemsError.message);
      return null;
    }

    return setData as { id: string; name: string };
  }

  async function createLearningSet() {
    const createdSet = await createStillLearningSet();

    if (!createdSet) return;

    Alert.alert(
      "Set oluşturuldu",
      `"${createdSet.name}" setine ${learningWordIds.length} kelime eklendi.`
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
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={styles.loadingText}>Kartlar hazırlanıyor...</Text>
      </View>
    );
  }

  if (words.length === 0) {
    return (
      <View style={styles.centeredContainer}>
        <Stack.Screen options={{ headerShown: false }} />

        <Text style={styles.emptyTitle}>Sıralanacak kelime yok</Text>
        <Text style={styles.emptyText}>
          {selectedSetName
            ? `"${selectedSetName}" seti boş. Önce sete kelime ekle.`
            : "Önce Kelimeler ekranından kelime ekle."}
        </Text>

        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Geri dön</Text>
        </Pressable>
      </View>
    );
  }

  if (complete) {
    return (
      <ScrollView contentContainerStyle={styles.completeContainer}>
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.completeCard}>
          <Text style={styles.completeEmoji}>🎉</Text>
          <Text style={styles.completeTitle}>Set tamamlandı!</Text>
          <Text style={styles.completeSubtitle}>
            {words.length} kelime gözden geçirildi
          </Text>

          <View style={styles.completeStatsRow}>
            <View style={styles.completeStat}>
              <Text style={styles.completeStatNumber}>{knownCount}</Text>
              <Text style={styles.completeStatLabel}>Biliyorum</Text>
            </View>

            <View style={styles.completeDivider} />

            <View style={styles.completeStat}>
              <Text style={styles.completeStatNumber}>{learningCount}</Text>
              <Text style={styles.completeStatLabel}>Çalışılacak</Text>
            </View>
          </View>

          <Pressable style={styles.primaryButton} onPress={loadWords}>
            <Text style={styles.primaryButtonText}>Tekrar Başla</Text>
          </Pressable>

          <Pressable style={styles.softButton} onPress={() => router.back()}>
            <Text style={styles.softButtonText}>Ana Sayfaya Dön</Text>
          </Pressable>
        </View>

        {learningWordIds.length > 0 ? (
          <View style={styles.learningSetCard}>
            <Text style={styles.learningSetTitle}>Çalışılacakları sete kaydet</Text>
            <Text style={styles.learningSetText}>
              Bilmiyorum dediğin kelimeleri ayrı bir sete taşıyabilirsin.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Set adı"
              placeholderTextColor={theme.colors.textSubtle}
              value={newSetName}
              onChangeText={setNewSetName}
              editable={!creatingSet}
            />

            <Pressable
              style={[
                styles.primaryButton,
                (!canCreateLearningSet || creatingSet) && styles.disabledButton,
              ]}
              onPress={createLearningSet}
              disabled={!canCreateLearningSet || creatingSet}
            >
              <Text style={styles.primaryButtonText}>
                {creatingSet ? "Oluşturuluyor..." : "Set oluştur"}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.softButton,
                (!canCreateLearningSet || creatingSet) && styles.disabledButton,
              ]}
              onPress={createLearningSetAndPractice}
              disabled={!canCreateLearningSet || creatingSet}
            >
              <Text style={styles.softButtonText}>Set oluştur ve çalış</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <Text style={styles.iconButtonText}>‹</Text>
        </Pressable>

        <View style={styles.topTitleBlock}>
          <Text style={styles.scopeText} numberOfLines={1}>
            {scopeTitle}
          </Text>
          <Text style={styles.progressLabel}>
            {currentCardNumber} / {words.length} kart
          </Text>
        </View>

        <Pressable style={styles.iconButton} onPress={loadWords}>
          <Text style={styles.restartText}>↻</Text>
        </Pressable>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>

      <View style={styles.choiceHintRow}>
        <Text style={styles.learningHint}>× Bilmiyorum</Text>
        <Text style={styles.knownHint}>Biliyorum ✓</Text>
      </View>

      <Pressable
        style={[
          styles.studyCard,
          revealed && styles.studyCardRevealed,
          feedback === "learning" && styles.studyCardWrong,
          feedback === "known" && styles.studyCardCorrect,
        ]}
        onPress={() => setRevealed((value) => !value)}
        disabled={Boolean(feedback)}
      >
        {!revealed ? (
          <>
            <View style={styles.tapPill}>
              <Text style={styles.tapPillText}>Çevirmek için dokun</Text>
            </View>

            <View style={styles.hiddenCardContent}>
              <Text style={styles.directionLabel}>İNG → TR</Text>
              <Text style={styles.hiddenWord}>{getDisplayWord(currentWord)}</Text>
              <Text style={styles.aiBadge}>AI kartı</Text>
            </View>
          </>
        ) : (
          <View style={styles.revealedContent}>
            <Text style={styles.revealedWord}>{getDisplayWord(currentWord)}</Text>

            <View style={styles.meaningBox}>
              <Text style={styles.meaningText}>{getMeaning(currentWord)}</Text>
            </View>

            {getExample(currentWord) ? (
              <View style={styles.exampleBox}>
                <View style={styles.exampleIcon}>
                  <Text style={styles.exampleIconText}>AI</Text>
                </View>
                <Text style={styles.exampleText}>“{getExample(currentWord)}”</Text>
              </View>
            ) : null}

            {!hasAiContent(currentContent) ? (
              <Text style={styles.warningText}>
                AI içeriği eksik. Yine de kartı sıralayabilirsin.
              </Text>
            ) : null}
          </View>
        )}

        {feedback ? (
          <View
            style={[
              styles.feedbackOverlay,
              feedback === "known"
                ? styles.feedbackOverlayKnown
                : styles.feedbackOverlayLearning,
            ]}
          >
            <View
              style={[
                styles.feedbackMark,
                feedback === "known"
                  ? styles.feedbackMarkKnown
                  : styles.feedbackMarkLearning,
              ]}
            >
              <Text style={styles.feedbackMarkText}>
                {feedback === "known" ? "✓" : "×"}
              </Text>
            </View>
          </View>
        ) : null}
      </Pressable>

      <View style={styles.bottomActions}>
        <Pressable
          style={[
            styles.bottomLearningButton,
            (savingChoice || Boolean(feedback)) && styles.disabledButton,
          ]}
          onPress={() => markCurrentWord("learning")}
          disabled={savingChoice || Boolean(feedback)}
        >
          <Text style={styles.bottomLearningText}>× Bilmiyorum</Text>
        </Pressable>

        <Pressable
          style={[
            styles.bottomKnownButton,
            (savingChoice || Boolean(feedback)) && styles.disabledButton,
          ]}
          onPress={() => markCurrentWord("known")}
          disabled={savingChoice || Boolean(feedback)}
        >
          <Text style={styles.bottomKnownText}>✓ Biliyorum</Text>
        </Pressable>
      </View>
    </View>
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
    "Anlam henüz oluşturulmadı."
  );
}

function getExample(item: SortWord) {
  const content = getContent(item);

  return content?.daily_life_example || content?.toefl_example || "";
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
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 18,
    paddingTop: 50,
    paddingBottom: 18,
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
    marginBottom: 12,
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
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
  restartText: {
    color: theme.colors.primaryDark,
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 28,
  },
  topTitleBlock: {
    flex: 1,
  },
  scopeText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 2,
  },
  progressLabel: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceSoft,
    overflow: "hidden",
    marginBottom: 14,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
  },
  choiceHintRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 6,
  },
  learningHint: {
    color: "#E99A9A",
    fontSize: 12,
    fontWeight: "900",
  },
  knownHint: {
    color: "#6FBF9D",
    fontSize: 12,
    fontWeight: "900",
  },
  studyCard: {
    flex: 1,
    minHeight: 390,
    backgroundColor: theme.colors.surface,
    borderRadius: 28,
    padding: 18,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
    ...theme.shadow.card,
  },
  studyCardRevealed: {
    justifyContent: "center",
  },
  studyCardWrong: {
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.dangerSoft,
  },
  studyCardCorrect: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.successSoft,
  },
  tapPill: {
    position: "absolute",
    top: 14,
    right: 14,
    backgroundColor: theme.colors.surfaceSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tapPillText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
  },
  hiddenCardContent: {
    alignItems: "center",
  },
  directionLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 18,
  },
  hiddenWord: {
    color: theme.colors.text,
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -1,
    textAlign: "center",
    marginBottom: 12,
  },
  aiBadge: {
    overflow: "hidden",
    color: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "900",
  },
  revealedContent: {
    alignItems: "center",
  },
  revealedWord: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 18,
  },
  meaningBox: {
    width: "100%",
    backgroundColor: theme.colors.primarySurface,
    borderWidth: 1,
    borderColor: theme.colors.primarySoft,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  meaningText: {
    color: theme.colors.primary,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "900",
    textAlign: "center",
  },
  exampleBox: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: theme.colors.surfaceSoft,
    borderRadius: 16,
    padding: 14,
  },
  exampleIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: theme.colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  exampleIconText: {
    color: theme.colors.accent,
    fontSize: 9,
    fontWeight: "900",
  },
  exampleText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
  },
  warningText: {
    marginTop: 14,
    color: theme.colors.warningDark,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    textAlign: "center",
  },
  feedbackOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  feedbackOverlayKnown: {
    backgroundColor: "rgba(221, 244, 233, 0.76)",
  },
  feedbackOverlayLearning: {
    backgroundColor: "rgba(255, 227, 222, 0.76)",
  },
  feedbackMark: {
    width: 62,
    height: 62,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  feedbackMarkKnown: {
    backgroundColor: theme.colors.success,
  },
  feedbackMarkLearning: {
    backgroundColor: theme.colors.danger,
  },
  feedbackMarkText: {
    color: theme.colors.textInverse,
    fontSize: 36,
    fontWeight: "900",
    lineHeight: 40,
  },
  bottomActions: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 14,
  },
  bottomLearningButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: "#FFE8E8",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomLearningText: {
    color: theme.colors.danger,
    fontSize: 15,
    fontWeight: "900",
  },
  bottomKnownButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: "#DCF4EA",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomKnownText: {
    color: theme.colors.successDark,
    fontSize: 15,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.55,
  },
  completeContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 34,
    backgroundColor: theme.colors.background,
  },
  completeCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 30,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 14,
    ...theme.shadow.card,
  },
  completeEmoji: {
    fontSize: 36,
    marginBottom: 12,
  },
  completeTitle: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 6,
  },
  completeSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 18,
  },
  completeStatsRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  completeStat: {
    flex: 1,
    alignItems: "center",
  },
  completeStatNumber: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  completeStatLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
  completeDivider: {
    width: 1,
    height: 36,
    backgroundColor: theme.colors.border,
  },
  learningSetCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  learningSetTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
  },
  learningSetText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceMuted,
    marginBottom: 12,
  },
  primaryButton: {
    width: "100%",
    minHeight: 50,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 8,
  },
  primaryButtonText: {
    color: theme.colors.textInverse,
    fontSize: 16,
    fontWeight: "900",
  },
  softButton: {
    width: "100%",
    minHeight: 50,
    backgroundColor: theme.colors.surfaceSoft,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 10,
  },
  softButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginBottom: 18,
  },
});
