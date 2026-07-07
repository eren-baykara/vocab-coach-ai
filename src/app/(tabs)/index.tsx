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
import { router, useFocusEffect } from "expo-router";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "../../lib/supabase";

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

export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [authLoading, setAuthLoading] = useState(false);
  const [wordsLoading, setWordsLoading] = useState(false);
  const [setsLoading, setSetsLoading] = useState(false);
  const [addingWord, setAddingWord] = useState(false);
  const [addingWordWithAi, setAddingWordWithAi] = useState(false);

  const [word, setWord] = useState("");

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
      Alert.alert("Missing word", "Please enter a word first.");
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
      Alert.alert("Could not add word", error.message);
      return;
    }

    const targetWord = await findUserWordByInput(cleanWord);

    if (!targetWord) {
      setAddingWord(false);
      setAddingWordWithAi(false);
      Alert.alert(
        "Word added",
        "The word was added to your Library, but I could not find it for the next step."
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
        Alert.alert("Word added, but could not add it to set", setError.message);
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
        Alert.alert(
          "Word added, but AI failed",
          await getFunctionErrorMessage(aiError)
        );
        await refreshAll();
        return;
      }
    }

    setAddingWord(false);
    setAddingWordWithAi(false);
    setWord("");
    await refreshAll();
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

  const wordActionLoading = addingWord || addingWordWithAi;

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
        <Text style={styles.loadingText}>Loading Vocab Coach AI...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Vocab Coach AI</Text>
          <Text style={styles.subtitle}>
            Don't memorize words. Learn how to use them.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Pressable
            style={[styles.button, authLoading && styles.disabledButton]}
            onPress={handleSignIn}
            disabled={authLoading}
          >
            <Text style={styles.buttonText}>
              {authLoading ? "Please wait..." : "Log in"}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.secondaryButton, authLoading && styles.disabledButton]}
            onPress={handleSignUp}
            disabled={authLoading}
          >
            <Text style={styles.secondaryButtonText}>Create account</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Vocab Coach AI</Text>
          <Text style={styles.subtitle}>Build sets. Practice words. Actually use them.</Text>
        </View>

        <Pressable style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.wordsHeader}>
          <Text style={styles.sectionTitle}>Choose a study set</Text>

          <Pressable onPress={loadSets} disabled={setsLoading}>
            <Text style={styles.refreshText}>
              {setsLoading ? "Loading..." : "Refresh"}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.setList}
        >
          <Pressable
            style={[
              styles.setChip,
              selectedSetId === null && styles.activeSetChip,
            ]}
            onPress={() => setSelectedSetId(null)}
          >
            <Text
              style={[
                styles.setChipTitle,
                selectedSetId === null && styles.activeSetChipTitle,
              ]}
            >
              Library
            </Text>
            <Text
              style={[
                styles.setChipMeta,
                selectedSetId === null && styles.activeSetChipMeta,
              ]}
            >
              {formatSetStats(libraryStats)}
            </Text>
          </Pressable>

          {sets.map((set) => {
            const active = selectedSetId === set.id;
            const stats = getSetStats(set.id);

            return (
              <Pressable
                key={set.id}
                style={[styles.setChip, active && styles.activeSetChip]}
                onPress={() => setSelectedSetId(set.id)}
              >
                <Text
                  style={[
                    styles.setChipTitle,
                    active && styles.activeSetChipTitle,
                  ]}
                >
                  {set.name}
                </Text>
                <Text
                  style={[
                    styles.setChipMeta,
                    active && styles.activeSetChipMeta,
                  ]}
                >
                  {formatSetStats(stats)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.setManagementHint}>
          <Text style={styles.setManagementHintText}>
            Create, rename, and delete sets from the Sets tab.
          </Text>

          <Pressable
            style={styles.setManagementHintButton}
            onPress={() => router.push("/sets" as never)}
          >
            <Text style={styles.setManagementHintButtonText}>Open Sets</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.practiceCard}>
        <Text style={styles.practiceEyebrow}>
          {selectedSet ? selectedSet.name : "Library"}
        </Text>
        <Text style={styles.practiceTitle}>Study plan</Text>
        <Text style={styles.practiceText}>{practiceSummaryText}</Text>

        <View style={styles.practiceStatsRow}>
          <View style={styles.practiceStatPill}>
            <Text style={styles.practiceStatNumber}>{aiReadyCount}</Text>
            <Text style={styles.practiceStatLabel}>ready</Text>
          </View>

          <View style={styles.practiceStatPill}>
            <Text style={styles.practiceStatNumber}>{dueCount}</Text>
            <Text style={styles.practiceStatLabel}>review today</Text>
          </View>
        </View>

        <View style={styles.studyBlock}>
          <Text style={styles.studyLabel}>Study flow</Text>

          <Pressable
            style={[
              styles.primaryStudyButton,
              visibleWords.length === 0 && styles.disabledButton,
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
            <View style={styles.practiceModeTextWrap}>
              <Text style={styles.primaryStudyTitle}>Card Sort</Text>
              <Text style={styles.primaryStudyDescription}>
                First, separate known words from words you still need.
              </Text>
              <Text style={styles.primaryStudyMeta}>
                {visibleWords.length > 0
                  ? `${visibleWords.length} cards available`
                  : "Add words first."}
              </Text>
            </View>

            <Text style={styles.primaryStudyChevron}>›</Text>
          </Pressable>
        </View>

        <Text style={styles.practiceModesHeading}>Practice modes</Text>

        <View style={styles.modeList}>
          <PracticeModeButton
            title="Meaning Quiz"
            description="See the word, choose the Turkish meaning."
            readyCount={meaningDueCount}
            totalReadyCount={meaningReadyCount}
            disabled={meaningReadyCount === 0}
            disabledReason={
              visibleWords.length === 0
                ? "Add words first."
                : meaningReadyCount === 0
                  ? "Generate AI content with Turkish meaning first."
                  : "Nothing due right now."
            }
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
          />

          <PracticeModeButton
            title="Reverse Quiz"
            description="See the meaning, choose the word."
            readyCount={reverseDueCount}
            totalReadyCount={reverseReadyCount}
            disabled={reverseReadyCount === 0}
            disabledReason={
              visibleWords.length === 0
                ? "Add words first."
                : reverseReadyCount === 0
                  ? "Generate AI content first."
                  : "Nothing due right now."
            }
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
          />

          <PracticeModeButton
            title="Fill in the Blank"
            description="Complete an example sentence."
            readyCount={fillDueCount}
            totalReadyCount={fillReadyCount}
            disabled={fillReadyCount === 0}
            disabledReason={
              visibleWords.length === 0
                ? "Add words first."
                : fillReadyCount === 0
                  ? "Generate AI example content first."
                  : "Nothing due right now."
            }
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
          />
        </View>
      </View>

       <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add a new word</Text>
        <Text style={styles.helperText}>
          {selectedSet
            ? `New words will be added to the "${selectedSet.name}" set.`
            : "Choose a set above to add the word there. Otherwise it goes only to Library."}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Example: usually"
          autoCapitalize="none"
          value={word}
          onChangeText={setWord}
          editable={!wordActionLoading}
          onSubmitEditing={() => handleAddWord(false)}
        />

        {wordSuggestions.length > 0 ? (
          <View style={styles.suggestionsWrap}>
            <Text style={styles.suggestionsLabel}>Suggestions</Text>

            <View style={styles.suggestionList}>
              {wordSuggestions.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  style={styles.suggestionChip}
                  onPress={() => setWord(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <Pressable
          style={[styles.button, wordActionLoading && styles.disabledButton]}
          onPress={() => handleAddWord(false)}
          disabled={wordActionLoading}
        >
          <Text style={styles.buttonText}>
            {addingWord ? "Adding..." : "Add word"}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.secondaryButton, wordActionLoading && styles.disabledButton]}
          onPress={() => handleAddWord(true)}
          disabled={wordActionLoading}
        >
          <Text style={styles.secondaryButtonText}>
            {addingWordWithAi ? "Generating..." : "Add + Generate AI"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Word archive</Text>
        <Text style={styles.helperText}>
          Open the Library tab to search all words, check AI readiness, and view
          word details.
        </Text>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.push("/library" as never)}
        >
          <Text style={styles.secondaryButtonText}>Open Library</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

type PracticeModeButtonProps = {
  title: string;
  description: string;
  readyCount: number;
  totalReadyCount: number;
  footerText?: string;
  disabled: boolean;
  disabledReason: string;
  onPress: () => void;
};

function PracticeModeButton({
  title,
  description,
  readyCount,
  totalReadyCount,
  footerText,
  disabled,
  disabledReason,
  onPress,
}: PracticeModeButtonProps) {
  return (
    <Pressable
      style={[styles.practiceModeButton, disabled && styles.disabledButton]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.practiceModeTextWrap}>
        <Text style={styles.practiceModeTitle}>{title}</Text>
        <Text style={styles.practiceModeDescription}>{description}</Text>
        <Text style={styles.practiceModeDescription}>
          {footerText
            ? footerText
            : disabled
              ? disabledReason
              : readyCount > 0
                ? `${readyCount} review today • ${totalReadyCount} ready`
                : `Practice anytime • ${totalReadyCount} ready`}
        </Text>
      </View>

      <Text style={styles.practiceModeChevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 12,
  },
  suggestionsLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  suggestionList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  suggestionText: {
    color: "#1d4ed8",
    fontSize: 14,
    fontWeight: "800",
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
});
