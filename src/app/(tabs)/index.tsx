import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, Tabs, useFocusEffect } from "expo-router";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "../../lib/supabase";
import { theme } from "../../theme";

type WordContent = {
  display_word: string | null;
  normalized_word: string | null;
  simple_definition: string | null;
  turkish_meaning: string | null;
  mini_lesson: string | null;
  toefl_example: string | null;
  daily_life_example: string | null;
  fill_blank_sentence: string | null;
};

type UserWord = {
  id: string;
  status: string | null;
  created_at: string;
  next_review_at: string | null;
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

type WordCorrectionSuggestion = {
  original_word: string;
  should_confirm: boolean;
  primary_suggestion: string;
  alternatives: string[];
  reason_tr: string;
};

const COMMON_WORD_SUGGESTIONS = [
  "usually",
  "usual",
  "usage",
  "use",
  "useful",
  "used to",
  "analyze",
  "approach",
  "assume",
  "benefit",
  "challenge",
  "compare",
  "consider",
  "consistent",
  "context",
  "define",
  "develop",
  "effective",
  "evidence",
  "expand",
  "explain",
  "focus",
  "improve",
  "include",
  "increase",
  "indicate",
  "maintain",
  "method",
  "occur",
  "process",
  "provide",
  "require",
  "significant",
  "similar",
  "specific",
  "structure",
  "suggest",
  "support",
  "therefore",
];

const VISIBLE_TAB_BAR_STYLE = {
  height: 82,
  paddingTop: 8,
  paddingBottom: 12,
  backgroundColor: theme.colors.surface,
  borderTopWidth: 1,
  borderTopColor: theme.colors.border,
} as const;

export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [passwordVisible, setPasswordVisible] = useState(false);

  const [authLoading, setAuthLoading] = useState(false);
  const [wordsLoading, setWordsLoading] = useState(false);
  const [setsLoading, setSetsLoading] = useState(false);
  const [addingWord, setAddingWord] = useState(false);
  const [addingWordWithAi, setAddingWordWithAi] = useState(false);
  const [checkingWordCorrection, setCheckingWordCorrection] = useState(false);

  const [word, setWord] = useState("");
  const [pendingCorrection, setPendingCorrection] =
    useState<WordCorrectionSuggestion | null>(null);
  const [pendingGenerateAiAfterAdd, setPendingGenerateAiAfterAdd] =
    useState(false);

  const [words, setWords] = useState<UserWord[]>([]);
  const [sets, setSets] = useState<WordSet[]>([]);
  const [setItems, setSetItems] = useState<WordSetItem[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitialLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadWords = useCallback(async () => {
    if (!session) return;

    setWordsLoading(true);

    const { data, error } = await supabase
      .from("user_words")
      .select(
        `
        id,
        status,
        created_at,
        next_review_at,
        word_contents (
          display_word,
          normalized_word,
          simple_definition,
          turkish_meaning,
          mini_lesson,
          toefl_example,
          daily_life_example,
          fill_blank_sentence
        )
      `
      )
      .order("created_at", { ascending: false });

    setWordsLoading(false);

    if (error) {
      Alert.alert("Could not load words", error.message);
      return;
    }

    setWords((data ?? []) as UserWord[]);
  }, [session]);

  const loadSets = useCallback(async () => {
    if (!session) return;

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
      .select("id, set_id, user_word_id");

    setSetsLoading(false);

    if (itemsError) {
      Alert.alert("Could not load set words", itemsError.message);
      return;
    }

    setSets((setsData ?? []) as WordSet[]);
    setSetItems((itemsData ?? []) as WordSetItem[]);
  }, [session]);

  async function refreshAll() {
    await Promise.all([loadWords(), loadSets()]);
  }

  useEffect(() => {
    if (session) {
      refreshAll();
    } else {
      setWords([]);
      setSets([]);
      setSetItems([]);
      setSelectedSetId(null);
    }
  }, [session, loadWords, loadSets]);

  useFocusEffect(
    useCallback(() => {
      if (session) {
        refreshAll();
      }
    }, [session, loadWords, loadSets])
  );

  async function handleSignUp() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing information", "Please enter your email and password.");
      return;
    }

    setAuthLoading(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    setAuthLoading(false);

    if (error) {
      Alert.alert("Sign up failed", error.message);
      return;
    }

    Alert.alert("Account created", "You can now start adding words.");
  }

  async function handleSignIn() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing information", "Please enter your email and password.");
      return;
    }

    setAuthLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setAuthLoading(false);

    if (error) {
      Alert.alert("Login failed", error.message);
    }
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert("Sign out failed", error.message);
    }
  }

  async function deleteSelectedSet() {
    if (!selectedSet) return;

    const { error } = await supabase
      .from("word_sets")
      .delete()
      .eq("id", selectedSet.id);

    if (error) {
      Alert.alert("Could not delete set", error.message);
      return;
    }

    setSelectedSetId(null);
    await loadSets();
  }

  function confirmRemoveWordFromSelectedSet(item: UserWord) {
    if (!selectedSet) return;

    Alert.alert(
      "Remove from set?",
      `Remove "${getDisplayWord(item)}" from "${selectedSet.name}"? The word will stay in Library.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeWordFromSelectedSet(item),
        },
      ]
    );
  }

  async function removeWordFromSelectedSet(item: UserWord) {
    if (!selectedSet) return;

    const { error } = await supabase
      .from("word_set_items")
      .delete()
      .eq("set_id", selectedSet.id)
      .eq("user_word_id", item.id);

    if (error) {
      Alert.alert("Could not remove word from set", error.message);
      return;
    }

    await loadSets();
  }

  async function handleAddWord(generateAiAfterAdd = false) {
    const cleanWord = word.trim();

    if (!cleanWord) {
      Alert.alert("Kelime eksik", "Lütfen önce bir kelime yaz.");
      return;
    }

    setPendingCorrection(null);
    setPendingGenerateAiAfterAdd(generateAiAfterAdd);
    setCheckingWordCorrection(true);

    const { data, error } = await supabase.functions.invoke(
      "suggest-word-correction",
      {
        body: {
          input_word: cleanWord,
        },
      }
    );

    setCheckingWordCorrection(false);

    if (error) {
      await addConfirmedWord(cleanWord, generateAiAfterAdd);
      return;
    }

    const suggestion = data as WordCorrectionSuggestion | null;
    const correctionOptions = suggestion
      ? getCorrectionOptions(suggestion, cleanWord)
      : [];

    if (suggestion?.should_confirm && correctionOptions.length > 0) {
      setPendingCorrection(suggestion);
      return;
    }

    await addConfirmedWord(
      suggestion?.primary_suggestion?.trim() || cleanWord,
      generateAiAfterAdd
    );
  }

  async function confirmCorrectionSelection(selectedWord: string) {
    const cleanWord = selectedWord.trim();

    if (!cleanWord) return;

    const generateAiAfterAdd = pendingGenerateAiAfterAdd;

    setPendingCorrection(null);
    setPendingGenerateAiAfterAdd(false);
    setWord(cleanWord);

    await addConfirmedWord(cleanWord, generateAiAfterAdd);
  }

  async function addConfirmedWord(cleanWord: string, generateAiAfterAdd = false) {
    if (!cleanWord) {
      Alert.alert("Kelime eksik", "Lütfen önce bir kelime yaz.");
      return;
    }

    if (generateAiAfterAdd) {
      setAddingWordWithAi(true);
    } else {
      setAddingWord(true);
    }

    const { error } = await supabase.rpc("add_user_word", {
      input_word: cleanWord,
    });

    if (error) {
      setAddingWord(false);
      setAddingWordWithAi(false);
      setPendingGenerateAiAfterAdd(false);
      Alert.alert("Kelime eklenemedi", error.message);
      return;
    }

    const targetWord = await findUserWordByInput(cleanWord);

    if (!targetWord) {
      setAddingWord(false);
      setAddingWordWithAi(false);
      setPendingGenerateAiAfterAdd(false);
      Alert.alert(
        "Kelime eklendi",
        "Kelime Library'ye eklendi ama sonraki adım için bulunamadı."
      );
      await refreshAll();
      return;
    }

    if (selectedSetId) {
      const { error: setError } = await supabase
        .from("word_set_items")
        .insert({
          set_id: selectedSetId,
          user_word_id: targetWord.id,
        });

      if (setError && setError.code !== "23505") {
        setAddingWord(false);
        setAddingWordWithAi(false);
        setPendingGenerateAiAfterAdd(false);
        Alert.alert("Kelime eklendi ama sete eklenemedi", setError.message);
        return;
      }
    }

    if (generateAiAfterAdd) {
      const { error: aiError } = await supabase.functions.invoke(
        "generate-word-content",
        {
          body: {
            user_word_id: targetWord.id,
          },
        }
      );

      if (aiError) {
        setAddingWord(false);
        setAddingWordWithAi(false);
        setPendingGenerateAiAfterAdd(false);
        Alert.alert(
          "Kelime eklendi ama AI başarısız oldu",
          await getFunctionErrorMessage(aiError)
        );
        await refreshAll();
        return;
      }
    }

    setAddingWord(false);
    setAddingWordWithAi(false);
    setPendingGenerateAiAfterAdd(false);
    setWord("");
    await refreshAll();
  }

  function getCorrectionOptions(
    suggestion: WordCorrectionSuggestion,
    originalWord: string
  ) {
    const normalizedOriginal = originalWord.trim().toLowerCase();
    const options = [
      suggestion.primary_suggestion,
      ...suggestion.alternatives,
    ];

    return Array.from(
      new Map(
        options
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
          .filter((item) => item.toLowerCase() !== normalizedOriginal)
          .map((item) => [item.toLowerCase(), item])
      ).values()
    ).slice(0, 3);
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

  async function findUserWordByInput(inputWord: string) {
    const normalizedInput = inputWord.trim().toLowerCase();

    const { data, error } = await supabase
      .from("user_words")
      .select(
        `
        id,
        created_at,
        word_contents (
          display_word,
          normalized_word
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      Alert.alert("Could not find word", error.message);
      return null;
    }

    const typedWords = (data ?? []) as Pick<
      UserWord,
      "id" | "created_at" | "word_contents"
    >[];

    return (
      typedWords.find((item) => {
        const content = getContent(item as UserWord);

        const displayWord = content?.display_word?.trim().toLowerCase();
        const normalizedWord = content?.normalized_word?.trim().toLowerCase();

        return displayWord === normalizedInput || normalizedWord === normalizedInput;
      }) ?? null
    );
  }

  function getContent(item: UserWord) {
    return Array.isArray(item.word_contents)
      ? item.word_contents[0]
      : item.word_contents;
  }

  function getDisplayWord(item: UserWord) {
    const content = getContent(item);

    return content?.display_word ?? "Untitled word";
  }

  function hasAiContent(item: UserWord) {
    const content = getContent(item);

    return Boolean(
      content?.turkish_meaning ||
        content?.simple_definition ||
        content?.mini_lesson
    );
  }

  function hasMeaningPracticeContent(item: UserWord) {
    const content = getContent(item);

    return Boolean(content?.turkish_meaning);
  }

  function hasReversePracticeContent(item: UserWord) {
    const content = getContent(item);

    return Boolean(content?.turkish_meaning || content?.simple_definition);
  }

  function hasFillPracticeContent(item: UserWord) {
    const content = getContent(item);

    const hasMeaning = Boolean(content?.turkish_meaning || content?.simple_definition);
    const hasExample = Boolean(
      content?.fill_blank_sentence ||
        content?.daily_life_example ||
        content?.toefl_example
    );

    return hasMeaning && hasExample;
  }

  function isDue(item: UserWord) {
    if (!item.next_review_at) return true;

    return new Date(item.next_review_at) <= new Date();
  }

  function openWordDetail(item: UserWord) {
    router.push({
      pathname: "/word/[id]",
      params: { id: item.id },
    });
  }

  function getWordsForSet(setId: string | null) {
    if (!setId) return words;

    const selectedWordIds = new Set(
      setItems
        .filter((item) => item.set_id === setId)
        .map((item) => item.user_word_id)
    );

    return words.filter((item) => selectedWordIds.has(item.id));
  }

  function getSetStats(setId: string | null) {
    const scopedWords = getWordsForSet(setId);
    const readyWords = scopedWords.filter(hasAiContent);
    const dueWords = readyWords.filter(isDue);

    return {
      total: scopedWords.length,
      ready: readyWords.length,
      due: dueWords.length,
    };
  }

  function formatSetStats(stats: { total: number; ready: number; due: number }) {
    return `${stats.total} words • ${stats.ready} ready • ${stats.due} today`;
  }

  const selectedSet = sets.find((set) => set.id === selectedSetId) ?? null;

  const visibleWords = useMemo(() => {
    return getWordsForSet(selectedSetId);
  }, [words, setItems, selectedSetId]);

  const libraryStats = getSetStats(null);

  const aiReadyCount = visibleWords.filter(hasAiContent).length;
  const meaningReadyCount = visibleWords.filter(hasMeaningPracticeContent).length;
  const reverseReadyCount = visibleWords.filter(hasReversePracticeContent).length;
  const fillReadyCount = visibleWords.filter(hasFillPracticeContent).length;

  const meaningDueCount = visibleWords.filter(
    (item) => hasMeaningPracticeContent(item) && isDue(item)
  ).length;
  const reverseDueCount = visibleWords.filter(
    (item) => hasReversePracticeContent(item) && isDue(item)
  ).length;
  const fillDueCount = visibleWords.filter(
    (item) => hasFillPracticeContent(item) && isDue(item)
  ).length;
  const dueCount = visibleWords.filter((item) => hasAiContent(item) && isDue(item)).length;

  const practiceScopeLabel = selectedSet ? "this set" : "your Library";
  const emptyPracticeText = selectedSet
    ? "This set is empty. Add words to start practicing."
    : "Add words or create a set to start practicing.";
  const practiceSummaryText =
    visibleWords.length === 0
      ? emptyPracticeText
      : aiReadyCount === 0
        ? "Open a word and generate AI content before practicing."
        : dueCount === 0
          ? `No scheduled review in ${practiceScopeLabel} right now.`
          : `Practice today’s review words in ${practiceScopeLabel}.`;

  const wordActionLoading =
    addingWord || addingWordWithAi || checkingWordCorrection;

  const wordSuggestions = useMemo(() => {
    const cleanInput = word.trim().toLowerCase();

    if (cleanInput.length < 2) return [];

    const existingWords = words
      .map((item) => getDisplayWord(item))
      .filter(Boolean);

    const combined = [...existingWords, ...COMMON_WORD_SUGGESTIONS];

    const uniqueSuggestions = Array.from(
      new Set(
        combined
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
          .filter((item) => item.toLowerCase() !== cleanInput)
          .filter((item) => item.toLowerCase().startsWith(cleanInput))
      )
    );

    return uniqueSuggestions.slice(0, 6);
  }, [word, words]);

  if (initialLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Kelimelik AI hazırlanıyor...</Text>
      </View>
    );
  }

  if (!session) {
    const isLoginMode = authMode === "login";

    return (
      <>
        <Tabs.Screen options={{ tabBarStyle: { display: "none" } }} />

        <KeyboardAvoidingView
          style={styles.authRoot}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.authScroll}
          >
            <View style={styles.authHero}>
              <View style={styles.authLogo}>
                <Text style={styles.authLogoText}>K</Text>
              </View>

              <Text style={styles.authBrandTitle}>Kelimelik AI</Text>
              <Text style={styles.authMotto}>
                Ezberleme. AI ile kullanmayı öğren.
              </Text>
            </View>

            <View style={styles.authSheet}>
              <View style={styles.authSegment}>
                <Pressable
                  style={[
                    styles.authSegmentButton,
                    isLoginMode && styles.authSegmentButtonActive,
                  ]}
                  onPress={() => setAuthMode("login")}
                  disabled={authLoading}
                >
                  <Text
                    style={[
                      styles.authSegmentText,
                      isLoginMode && styles.authSegmentTextActive,
                    ]}
                  >
                    Giriş Yap
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.authSegmentButton,
                    !isLoginMode && styles.authSegmentButtonActive,
                  ]}
                  onPress={() => setAuthMode("signup")}
                  disabled={authLoading}
                >
                  <Text
                    style={[
                      styles.authSegmentText,
                      !isLoginMode && styles.authSegmentTextActive,
                    ]}
                  >
                    Kayıt Ol
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.authLabel}>E-POSTA</Text>
              <TextInput
                style={styles.authInput}
                placeholder="ornek@kelimelik.ai"
                placeholderTextColor={theme.colors.textSubtle}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                value={email}
                onChangeText={setEmail}
              />

              <Text style={styles.authLabel}>ŞİFRE</Text>
              <View style={styles.authPasswordRow}>
                <TextInput
                  style={styles.authPasswordInput}
                  placeholder="••••••••"
                  placeholderTextColor={theme.colors.textSubtle}
                  secureTextEntry={!passwordVisible}
                  value={password}
                  onChangeText={setPassword}
                />

                <Pressable
                  style={styles.authPasswordToggle}
                  onPress={() => setPasswordVisible((current) => !current)}
                >
                  <Text style={styles.authPasswordToggleText}>
                    {passwordVisible ? "Gizle" : "Göster"}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                style={[
                  styles.authPrimaryButton,
                  authLoading && styles.authPrimaryButtonDisabled,
                ]}
                onPress={isLoginMode ? handleSignIn : handleSignUp}
                disabled={authLoading}
              >
                <Text style={styles.authPrimaryButtonText}>
                  {authLoading
                    ? "Lütfen bekle..."
                    : isLoginMode
                      ? "Giriş Yap"
                      : "Hesap Oluştur"}
                </Text>
              </Pressable>

              <View style={styles.authFooter}>
                <Text style={styles.authFooterMuted}>
                  {isLoginMode ? "Hesabın yok mu?" : "Zaten üyeysen"}
                </Text>

                <Pressable
                  onPress={() => setAuthMode(isLoginMode ? "signup" : "login")}
                  disabled={authLoading}
                >
                  <Text style={styles.authFooterAction}>
                    {isLoginMode ? " Kayıt Ol →" : " Giriş Yap →"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </>
    );
  }

  const todayLabel = getTodayLabel();
  const scopeLabel = selectedSet ? selectedSet.name : "Tüm kelimeler";
  const readyPercent =
    visibleWords.length > 0
      ? Math.min(100, Math.round((aiReadyCount / visibleWords.length) * 100))
      : 0;
  const reviewPercent =
    aiReadyCount > 0 ? Math.min(100, Math.round((dueCount / aiReadyCount) * 100)) : 0;
  const featuredWord =
    visibleWords.find(hasAiContent) ?? visibleWords[0] ?? words[0] ?? null;
  const featuredWordText = featuredWord ? getDisplayWord(featuredWord) : "context";
  const setCards = sets.slice(0, 2).map((set) => ({
    set,
    stats: getSetStats(set.id),
  }));

  return (
    <>
      <Tabs.Screen options={{ tabBarStyle: VISIBLE_TAB_BAR_STYLE }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.todayContainer}
      >
        <View style={styles.todayHeader}>
          <View style={styles.todayHeaderText}>
            <Text style={styles.todayDate}>{todayLabel}</Text>
            <Text style={styles.todayGreeting}>Merhaba 👋</Text>
            <Text style={styles.todaySubtitle}>Bugünün çalışması hazır.</Text>
          </View>

          <View style={styles.todayBellButton}>
            <Text style={styles.todayBellIcon}>🔔</Text>
          </View>
        </View>

        <View style={styles.todayMetricGrid}>
          <View style={styles.todayMetricCard}>
            <Text style={styles.todayMetricIcon}>🔥</Text>
            <Text style={styles.todayMetricValue}>{dueCount}</Text>
            <Text style={styles.todayMetricLabel}>bugün</Text>
          </View>

          <View style={styles.todayMetricCard}>
            <Text style={styles.todayMetricIcon}>📚</Text>
            <Text style={styles.todayMetricValue}>{aiReadyCount}</Text>
            <Text style={styles.todayMetricLabel}>hazır</Text>
          </View>

          <View style={styles.todayMetricCard}>
            <Text style={styles.todayMetricIcon}>🎯</Text>
            <Text style={styles.todayMetricValue}>{readyPercent}%</Text>
            <Text style={styles.todayMetricLabel}>AI oranı</Text>
          </View>
        </View>

        <View style={styles.todayGoalCard}>
          <View style={styles.todayGoalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.todayGoalTitle}>Günlük Odak</Text>
              <Text style={styles.todayGoalText}>
                {visibleWords.length === 0
                  ? "Bugün çalışmak için kelime ekle."
                  : `${scopeLabel} içinde ${dueCount} kelime tekrar bekliyor.`}
              </Text>
            </View>

            <View style={styles.todayGoalBadge}>
              <Text style={styles.todayGoalBadgeText}>{reviewPercent}%</Text>
            </View>
          </View>

          <View style={styles.todayProgressTrack}>
            <View
              style={[
                styles.todayProgressFill,
                { width: `${Math.max(8, reviewPercent)}%` },
              ]}
            />
          </View>

          <View style={styles.todayGoalMetaRow}>
            <Text style={styles.todayGoalMeta}>{dueCount} tekrar</Text>
            <Text style={styles.todayGoalMeta}>{aiReadyCount} hazır kelime</Text>
          </View>
        </View>

        <View style={styles.todayStudyCard}>
          <View style={styles.todayStudyTopRow}>
            <View style={styles.todayStudyIconWrap}>
              <Text style={styles.todayStudyIcon}>⚡</Text>
            </View>

            <View style={styles.todayStudyTextWrap}>
              <Text style={styles.todayStudyEyebrow}>{scopeLabel}</Text>
              <Text style={styles.todayStudyTitle}>Bugünün Çalışması</Text>
              <Text style={styles.todayStudyText}>
                Önce kartları ayır, sonra quizlerle kelimeyi gerçekten kullanmayı
                öğren.
              </Text>
            </View>
          </View>

          <View style={styles.todayStudyPills}>
            <View style={styles.todayStudyPill}>
              <Text style={styles.todayStudyPillText}>{visibleWords.length} kart</Text>
            </View>

            <View style={styles.todayStudyPill}>
              <Text style={styles.todayStudyPillText}>{dueCount} tekrar</Text>
            </View>

            <View style={styles.todayStudyPill}>
              <Text style={styles.todayStudyPillText}>{aiReadyCount} AI hazır</Text>
            </View>
          </View>

          <Pressable
            style={[
              styles.todayPrimaryButton,
              visibleWords.length === 0 && styles.todayPrimaryButtonDisabled,
            ]}
            onPress={() =>
              router.push({
                pathname: "/card-sort" as never,
                params: selectedSet
                  ? {
                      setId: selectedSet.id,
                      setName: selectedSet.name,
                    }
                  : {},
              })
            }
            disabled={visibleWords.length === 0}
          >
            <Text style={styles.todayPrimaryButtonText}>Çalışmaya Başla</Text>
            <Text style={styles.todayPrimaryButtonArrow}>›</Text>
          </Pressable>
        </View>

        <View style={styles.todayModesSection}>
          <View style={styles.todaySectionHeader}>
            <Text style={styles.todaySectionTitle}>Pratik Modları</Text>
            <Text style={styles.todaySectionMeta}>{scopeLabel}</Text>
          </View>

          <View style={styles.todayModeGrid}>
            <Pressable
              style={[
                styles.todayModeCard,
                meaningReadyCount === 0 && styles.todayModeCardDisabled,
              ]}
              onPress={() =>
                router.push({
                  pathname: "/review",
                  params: selectedSet
                    ? {
                        setId: selectedSet.id,
                        setName: selectedSet.name,
                        mode: "meaning",
                      }
                    : { mode: "meaning" },
                })
              }
              disabled={meaningReadyCount === 0}
            >
              <Text style={styles.todayModeIcon}>🧠</Text>
              <Text style={styles.todayModeTitle}>Anlam</Text>
              <Text style={styles.todayModeMeta}>
                {meaningDueCount > 0 ? `${meaningDueCount} bugün` : `${meaningReadyCount} hazır`}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.todayModeCard,
                reverseReadyCount === 0 && styles.todayModeCardDisabled,
              ]}
              onPress={() =>
                router.push({
                  pathname: "/review",
                  params: selectedSet
                    ? {
                        setId: selectedSet.id,
                        setName: selectedSet.name,
                        mode: "reverse",
                      }
                    : { mode: "reverse" },
                })
              }
              disabled={reverseReadyCount === 0}
            >
              <Text style={styles.todayModeIcon}>🔁</Text>
              <Text style={styles.todayModeTitle}>Ters Quiz</Text>
              <Text style={styles.todayModeMeta}>
                {reverseDueCount > 0 ? `${reverseDueCount} bugün` : `${reverseReadyCount} hazır`}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.todayModeCard,
                fillReadyCount === 0 && styles.todayModeCardDisabled,
              ]}
              onPress={() =>
                router.push({
                  pathname: "/review",
                  params: selectedSet
                    ? {
                        setId: selectedSet.id,
                        setName: selectedSet.name,
                        mode: "fill",
                      }
                    : { mode: "fill" },
                })
              }
              disabled={fillReadyCount === 0}
            >
              <Text style={styles.todayModeIcon}>✍️</Text>
              <Text style={styles.todayModeTitle}>Boşluk</Text>
              <Text style={styles.todayModeMeta}>
                {fillDueCount > 0 ? `${fillDueCount} bugün` : `${fillReadyCount} hazır`}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.todayTipCard}>
          <View style={styles.todayTipIconWrap}>
            <Text style={styles.todayTipIcon}>✨</Text>
          </View>

          <View style={styles.todayTipTextWrap}>
            <Text style={styles.todayTipTitle}>AI Öğrenme İpucu</Text>
            <Text style={styles.todayTipText}>
              “{featuredWordText}” kelimesini sadece anlamıyla değil, örnek cümle
              içinde nasıl kullanıldığını görerek çalış.
            </Text>
          </View>
        </View>

        <View style={styles.todaySetsSection}>
          <View style={styles.todaySectionHeader}>
            <Text style={styles.todaySectionTitle}>Aktif Setler</Text>

            <Pressable onPress={() => router.push("/sets" as never)}>
              <Text style={styles.todaySectionAction}>Tümü →</Text>
            </Pressable>
          </View>

          <View style={styles.todaySetList}>
            <Pressable
              style={[
                styles.todaySetCard,
                selectedSetId === null && styles.todaySetCardActive,
              ]}
              onPress={() => setSelectedSetId(null)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.todaySetTitle}>Tüm Kelimeler</Text>
                <Text style={styles.todaySetMeta}>
                  {libraryStats.total} kelime • {libraryStats.ready} hazır
                </Text>
              </View>

              <Text style={styles.todaySetPercent}>
                {libraryStats.total > 0
                  ? Math.round((libraryStats.ready / libraryStats.total) * 100)
                  : 0}
                %
              </Text>
            </Pressable>

            {setCards.map(({ set, stats }) => (
              <Pressable
                key={set.id}
                style={[
                  styles.todaySetCard,
                  selectedSetId === set.id && styles.todaySetCardActive,
                ]}
                onPress={() => setSelectedSetId(set.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.todaySetTitle}>{set.name}</Text>
                  <Text style={styles.todaySetMeta}>
                    {stats.total} kelime • {stats.due} bugün
                  </Text>
                </View>

                <Text style={styles.todaySetPercent}>
                  {stats.total > 0
                    ? Math.round((stats.ready / stats.total) * 100)
                    : 0}
                  %
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.todayQuickAddCard}>
          <View style={styles.todayQuickAddHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.todayQuickAddEyebrow}>Hızlı Ekle</Text>
              <Text style={styles.todayQuickAddTitle}>Yeni kelime ekle</Text>
            </View>

            <View style={styles.todayQuickAddScope}>
              <Text style={styles.todayQuickAddScopeText} numberOfLines={1}>
                {selectedSet ? selectedSet.name : "Kütüphane"}
              </Text>
            </View>
          </View>

          <TextInput
            style={styles.todayQuickAddInput}
            placeholder="Örn: usually"
            placeholderTextColor={theme.colors.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            value={word}
            onChangeText={(value) => {
              setWord(value);
              setPendingCorrection(null);
            }}
            editable={!wordActionLoading}
            onSubmitEditing={() => handleAddWord(false)}
            returnKeyType="done"
          />

          {wordSuggestions.length > 0 && !pendingCorrection ? (
            <View style={styles.todaySuggestionsWrap}>
              {wordSuggestions.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  style={styles.todaySuggestionChip}
                  onPress={() => setWord(suggestion)}
                >
                  <Text style={styles.todaySuggestionText}>{suggestion}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {pendingCorrection ? (
            <View style={styles.todayCorrectionCard}>
              <Text style={styles.todayCorrectionTitle}>
                Bunu mu demek istedin?
              </Text>
              <Text style={styles.todayCorrectionText}>
                {pendingCorrection.reason_tr}
              </Text>

              <View style={styles.todayCorrectionOptions}>
                {getCorrectionOptions(pendingCorrection, word).map((option) => (
                  <Pressable
                    key={option}
                    style={styles.todayCorrectionChip}
                    onPress={() => confirmCorrectionSelection(option)}
                    disabled={wordActionLoading}
                  >
                    <Text style={styles.todayCorrectionChipText}>{option}</Text>
                  </Pressable>
                ))}

                <Pressable
                  style={styles.todayCorrectionOriginalChip}
                  onPress={() =>
                    confirmCorrectionSelection(
                      pendingCorrection.original_word || word
                    )
                  }
                  disabled={wordActionLoading}
                >
                  <Text style={styles.todayCorrectionOriginalText}>
                    Yazdığım gibi ekle
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.todayQuickAddActions}>
            <Pressable
              style={[
                styles.todayQuickAddPrimary,
                wordActionLoading && styles.todayPrimaryButtonDisabled,
              ]}
              onPress={() => handleAddWord(true)}
              disabled={wordActionLoading}
            >
              <Text style={styles.todayQuickAddPrimaryText}>
                {checkingWordCorrection
                  ? "Kontrol ediliyor..."
                  : addingWordWithAi
                    ? "AI hazırlanıyor..."
                    : "Ekle + AI Oluştur"}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.todayQuickAddSecondary,
                wordActionLoading && styles.todayPrimaryButtonDisabled,
              ]}
              onPress={() => handleAddWord(false)}
              disabled={wordActionLoading}
            >
              <Text style={styles.todayQuickAddSecondaryText}>
                {checkingWordCorrection
                  ? "Kontrol..."
                  : addingWord
                    ? "Ekleniyor..."
                    : "Sadece Ekle"}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

function getTodayLabel() {
  const days = [
    "Pazar",
    "Pazartesi",
    "Salı",
    "Çarşamba",
    "Perşembe",
    "Cuma",
    "Cumartesi",
  ];

  const months = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ];

  const today = new Date();

  return `${days[today.getDay()]}, ${today.getDate()} ${
    months[today.getMonth()]
  }`;
}


function PracticeModeButton(props: any) {
  const {
    title,
    subtitle,
    meta,
    count,
    disabled,
    loading,
    onPress,
  } = props;

  const description = subtitle ?? meta ?? "";

  return (
    <Pressable
      style={[
        styles.practiceModeButton,
        disabled && { opacity: 0.48 },
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 16,
            fontWeight: "900",
            lineHeight: 22,
          }}
        >
          {title}
        </Text>

        {description ? (
          <Text
            style={{
              marginTop: 4,
              color: theme.colors.textMuted,
              fontSize: 13,
              fontWeight: "700",
              lineHeight: 18,
            }}
          >
            {description}
          </Text>
        ) : null}
      </View>

      {typeof count === "number" ? (
        <View
          style={{
            minWidth: 34,
            height: 34,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.primarySurface,
          }}
        >
          <Text
            style={{
              color: theme.colors.primary,
              fontSize: 13,
              fontWeight: "900",
            }}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}


const styles = StyleSheet.create({
  todayContainer: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: 62,
    paddingBottom: 118,
    backgroundColor: theme.colors.background,
  },
  todayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xl,
  },
  todayHeaderText: {
    flex: 1,
    paddingRight: theme.spacing.md,
  },
  todayDate: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: theme.spacing.xs,
  },
  todayGreeting: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 38,
  },
  todaySubtitle: {
    marginTop: theme.spacing.xs,
    color: theme.colors.textMuted,
    fontSize: 15,
    fontWeight: "700",
  },
  todayBellButton: {
    width: 46,
    height: 46,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  todayBellIcon: {
    fontSize: 19,
  },
  todayMetricGrid: {
    flexDirection: "row",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  todayMetricCard: {
    flex: 1,
    minHeight: 98,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  todayMetricIcon: {
    fontSize: 19,
    marginBottom: theme.spacing.sm,
  },
  todayMetricValue: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28,
  },
  todayMetricLabel: {
    marginTop: 2,
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  todayGoalCard: {
    borderRadius: theme.radius["2xl"],
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
    ...theme.shadow.card,
  },
  todayGoalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  todayGoalTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 25,
  },
  todayGoalText: {
    marginTop: theme.spacing.xs,
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  todayGoalBadge: {
    minWidth: 52,
    height: 34,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primarySurface,
  },
  todayGoalBadgeText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  todayProgressTrack: {
    height: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceSoft,
    overflow: "hidden",
    marginTop: theme.spacing.lg,
  },
  todayProgressFill: {
    height: "100%",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
  },
  todayGoalMetaRow: {
    marginTop: theme.spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  todayGoalMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  todayStudyCard: {
    borderRadius: theme.radius["3xl"],
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.primary,
    marginBottom: theme.spacing.xl,
    shadowColor: "#3D2A20",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 5,
  },
  todayStudyTopRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  todayStudyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  todayStudyIcon: {
    fontSize: 22,
  },
  todayStudyTextWrap: {
    flex: 1,
  },
  todayStudyEyebrow: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: theme.spacing.xs,
  },
  todayStudyTitle: {
    color: theme.colors.textInverse,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
  },
  todayStudyText: {
    marginTop: theme.spacing.sm,
    color: "rgba(255,255,255,0.86)",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
  },
  todayStudyPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  todayStudyPill: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  todayStudyPillText: {
    color: theme.colors.textInverse,
    fontSize: 12,
    fontWeight: "900",
  },
  todayPrimaryButton: {
    height: 52,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  todayPrimaryButtonDisabled: {
    opacity: 0.55,
  },
  todayPrimaryButtonText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: "900",
  },
  todayPrimaryButtonArrow: {
    color: theme.colors.primary,
    fontSize: 26,
    fontWeight: "900",
    marginTop: -2,
  },
  todayModesSection: {
    marginBottom: theme.spacing.xl,
  },
  todaySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  todaySectionTitle: {
    color: theme.colors.text,
    fontSize: 21,
    fontWeight: "900",
  },
  todaySectionMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
  },
  todaySectionAction: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  todayModeGrid: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  todayModeCard: {
    flex: 1,
    minHeight: 122,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  todayModeCardDisabled: {
    opacity: 0.48,
  },
  todayModeIcon: {
    fontSize: 21,
    marginBottom: theme.spacing.md,
  },
  todayModeTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
  },
  todayModeMeta: {
    marginTop: theme.spacing.xs,
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  todayTipCard: {
    flexDirection: "row",
    gap: theme.spacing.md,
    borderRadius: theme.radius["2xl"],
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.accentSoft,
    marginBottom: theme.spacing.xl,
  },
  todayTipIconWrap: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  todayTipIcon: {
    fontSize: 19,
  },
  todayTipTextWrap: {
    flex: 1,
  },
  todayTipTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: theme.spacing.xs,
  },
  todayTipText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
  },
  todaySetsSection: {
    marginBottom: theme.spacing.xl,
  },
  todaySetList: {
    gap: theme.spacing.md,
  },
  todaySetCard: {
    minHeight: 72,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  todaySetCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySurface,
  },
  todaySetTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  todaySetMeta: {
    marginTop: theme.spacing.xs,
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  todaySetPercent: {
    color: theme.colors.primary,
    fontSize: 18,
    fontWeight: "900",
  },
  todayQuickAddCard: {
    borderRadius: theme.radius["2xl"],
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  todayQuickAddHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  todayQuickAddEyebrow: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: theme.spacing.xs,
  },
  todayQuickAddTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  todayQuickAddScope: {
    maxWidth: 128,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceSoft,
  },
  todayQuickAddScopeText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
  },
  todayQuickAddInput: {
    height: 50,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  todaySuggestionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  todaySuggestionChip: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.primarySurface,
  },
  todaySuggestionText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  todayQuickAddActions: {
    flexDirection: "row",
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  todayQuickAddPrimary: {
    flex: 1.25,
    height: 48,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
  },
  todayQuickAddPrimaryText: {
    color: theme.colors.textInverse,
    fontSize: 14,
    fontWeight: "900",
  },
  todayQuickAddSecondary: {
    flex: 1,
    height: 48,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceSoft,
  },
  todayQuickAddSecondaryText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  authRoot: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  authScroll: {
    flexGrow: 1,
    backgroundColor: theme.colors.background,
  },
  authHero: {
    minHeight: 194,
    paddingTop: 42,
    paddingHorizontal: theme.spacing["2xl"],
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderBottomLeftRadius: theme.radius["3xl"],
    borderBottomRightRadius: theme.radius["3xl"],
  },
  authLogo: {
    width: 58,
    height: 58,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.34)",
    marginBottom: theme.spacing.lg,
  },
  authLogoText: {
    color: theme.colors.textInverse,
    fontSize: 25,
    fontWeight: "900",
  },
  authBrandTitle: {
    color: theme.colors.textInverse,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
  },
  authMotto: {
    marginTop: theme.spacing.sm,
    color: "rgba(255,255,255,0.88)",
    fontSize: 13,
    fontWeight: "800",
  },
  authSheet: {
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing["3xl"],
  },
  authSegment: {
    height: 42,
    flexDirection: "row",
    padding: 4,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceSoft,
    marginBottom: theme.spacing.md,
  },
  authSegmentButton: {
    flex: 1,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  authSegmentButtonActive: {
    backgroundColor: theme.colors.surface,
    shadowColor: "#3D2A20",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 2,
  },
  authSegmentText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: "900",
  },
  authSegmentTextActive: {
    color: theme.colors.text,
  },
  authLabel: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  authInput: {
    height: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.lg,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  authPasswordRow: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceSoft,
    paddingLeft: theme.spacing.lg,
    paddingRight: theme.spacing.sm,
  },
  authPasswordInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  authPasswordToggle: {
    minWidth: 56,
    height: 34,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  authPasswordToggleText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
  },
  authPrimaryButton: {
    height: 48,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
    marginTop: theme.spacing.lg,
    shadowColor: "#3D2A20",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 3,
  },
  authPrimaryButtonDisabled: {
    opacity: 0.65,
  },
  authPrimaryButtonText: {
    color: theme.colors.textInverse,
    fontSize: 15,
    fontWeight: "900",
  },
  authFooter: {
    marginTop: theme.spacing["2xl"],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  authFooterMuted: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  authFooterAction: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 32,
    backgroundColor: "#f8fafc",
  },
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#475569",
  },
  header: {
    marginBottom: 18,
    gap: 14,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  setList: {
    gap: 10,
    paddingBottom: 12,
  },
  setChip: {
    minWidth: 210,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 18,
    padding: 14,
  },
  activeSetChip: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  setChipTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 5,
  },
  activeSetChipTitle: {
    color: "#ffffff",
  },
  setChipMeta: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: "#64748b",
  },
  activeSetChipMeta: {
    color: "#dbeafe",
  },
  setManagementHint: {
    marginTop: 4,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
  },
  setManagementHintText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748b",
    fontWeight: "700",
  },
  setManagementHintButton: {
    alignSelf: "flex-start",
    backgroundColor: "#e0f2fe",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  setManagementHintButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0369a1",
  },
  practiceCard: {
    backgroundColor: "#2563eb",
    borderRadius: 28,
    padding: 22,
    marginBottom: 20,
  },
  practiceEyebrow: {
    color: "#bfdbfe",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  practiceTitle: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 8,
  },
  practiceText: {
    color: "#dbeafe",
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 16,
  },
  practiceStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  practiceStatPill: {
    flex: 1,
    backgroundColor: "#1d4ed8",
    borderRadius: 16,
    padding: 14,
  },
  practiceStatNumber: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 2,
  },
  practiceStatLabel: {
    color: "#bfdbfe",
    fontSize: 13,
    fontWeight: "700",
  },
  practiceButton: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  practiceButtonText: {
    color: "#1d4ed8",
    fontSize: 16,
    fontWeight: "900",
  },
  modeList: {
    gap: 10,
  },
  studyBlock: {
    marginTop: 18,
    marginBottom: 18,
  },
  studyLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: "#1e40af",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  primaryStudyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: 18,
    borderRadius: 22,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  primaryStudyTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1e3a8a",
    marginBottom: 6,
  },
  primaryStudyDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: "#1e40af",
    fontWeight: "700",
  },
  primaryStudyMeta: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "900",
    color: "#2563eb",
  },
  primaryStudyChevron: {
    fontSize: 34,
    fontWeight: "900",
    color: "#2563eb",
  },
  practiceModesHeading: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 10,
  },
  practiceModeButton: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  practiceModeTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  practiceModeTitle: {
    color: "#1d4ed8",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 4,
  },
  practiceModeDescription: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  practiceModeChevron: {
    color: "#93c5fd",
    fontSize: 30,
    fontWeight: "700",
  },
  statsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "700",
  },
  statDivider: {
    width: 1,
    height: 44,
    backgroundColor: "#e2e8f0",
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 10,
  },
  helperText: {
    fontSize: 15,
    color: "#64748b",
    lineHeight: 22,
    marginBottom: 14,
  },
  quickAddCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  quickAddHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  quickAddTitleBlock: {
    flex: 1,
  },
  quickAddEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  quickAddTitle: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
  },
  quickAddScopePill: {
    maxWidth: "42%",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickAddScopeLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  quickAddScopeValue: {
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: "900",
  },
  quickAddSubtitle: {
    color: "#64748b",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  quickAddInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 17,
    color: "#0f172a",
    marginBottom: 12,
  },
  quickAddActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  quickAddPrimaryButton: {
    flex: 1.4,
    backgroundColor: "#2563eb",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  quickAddPrimaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  quickAddSecondaryButton: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  quickAddSecondaryButtonText: {
    color: "#334155",
    fontSize: 15,
    fontWeight: "900",
  },
  quickAddTip: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#0f172a",
    marginBottom: 12,
  },
  suggestionsWrap: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  suggestionsLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  suggestionList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  suggestionText: {
    color: "#1d4ed8",
    fontSize: 14,
    fontWeight: "900",
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
    fontWeight: "800",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryButtonText: {
    color: "#2563eb",
    fontSize: 16,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.6,
  },
  signOutButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  signOutButtonText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "800",
  },
  wordsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  refreshText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "800",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 28,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
  },
  wordList: {
    gap: 10,
  },
  wordItem: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    overflow: "hidden",
  },
  wordOpenArea: {
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  removeFromSetButton: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  removeFromSetButtonText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "900",
  },
  wordMainContent: {
    flex: 1,
    paddingRight: 12,
  },
  wordText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusBadge: {
    backgroundColor: "#e0f2fe",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeText: {
    color: "#0369a1",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  aiBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  aiReadyBadge: {
    backgroundColor: "#dcfce7",
  },
  aiMissingBadge: {
    backgroundColor: "#fef3c7",
  },
  aiBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  aiReadyBadgeText: {
    color: "#166534",
  },
  aiMissingBadgeText: {
    color: "#92400e",
  },
  chevron: {
    fontSize: 30,
    color: "#94a3b8",
  },
  todayCorrectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.primarySurface,
    padding: 13,
    marginBottom: 14,
  },
  todayCorrectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 4,
  },
  todayCorrectionText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: theme.colors.textMuted,
    marginBottom: 10,
  },
  todayCorrectionOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  todayCorrectionChip: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  todayCorrectionChipText: {
    fontSize: 13,
    fontWeight: "900",
    color: theme.colors.textInverse,
  },
  todayCorrectionOriginalChip: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  todayCorrectionOriginalText: {
    fontSize: 13,
    fontWeight: "900",
    color: theme.colors.textMuted,
  },

});
