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
};

type UserWord = {
  id: string;
  status: string | null;
  created_at: string;
  next_review_at: string | null;
  word_contents: WordContent | WordContent[] | null;
};

const LIBRARY_SELECT = `
  id,
  status,
  created_at,
  next_review_at,
  word_contents (
    display_word,
    normalized_word,
    simple_definition,
    turkish_meaning,
    mini_lesson
  )
`;

export default function LibraryScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [wordsLoading, setWordsLoading] = useState(false);
  const [words, setWords] = useState<UserWord[]>([]);
  const [searchText, setSearchText] = useState("");

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
      .select(LIBRARY_SELECT)
      .order("created_at", { ascending: false });

    setWordsLoading(false);

    if (error) {
      Alert.alert("Could not load Library", error.message);
      return;
    }

    setWords((data ?? []) as UserWord[]);
  }, [session]);

  useEffect(() => {
    if (session) {
      loadWords();
    } else {
      setWords([]);
    }
  }, [session, loadWords]);

  useFocusEffect(
    useCallback(() => {
      if (session) {
        loadWords();
      }
    }, [session, loadWords])
  );

  const filteredWords = useMemo(() => {
    const cleanSearch = searchText.trim().toLowerCase();

    if (!cleanSearch) return words;

    return words.filter((item) => {
      const content = getContent(item);
      const displayWord = content?.display_word?.toLowerCase() ?? "";
      const normalizedWord = content?.normalized_word?.toLowerCase() ?? "";
      const meaning = content?.turkish_meaning?.toLowerCase() ?? "";
      const definition = content?.simple_definition?.toLowerCase() ?? "";

      return (
        displayWord.includes(cleanSearch) ||
        normalizedWord.includes(cleanSearch) ||
        meaning.includes(cleanSearch) ||
        definition.includes(cleanSearch)
      );
    });
  }, [words, searchText]);

  const readyCount = words.filter(hasAiContent).length;
  const needsAiCount = words.length - readyCount;

  function openWordDetail(item: UserWord) {
    router.push({
      pathname: "/word/[id]",
      params: { id: item.id },
    });
  }

  if (initialLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading Library...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.emptyTitle}>Log in first</Text>
        <Text style={styles.emptyText}>
          Your saved words will appear here after you log in.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Library</Text>
        <Text style={styles.title}>Your word archive</Text>
        <Text style={styles.subtitle}>
          All saved words live here. Open any word to view details, notes, sets,
          and AI content.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{words.length}</Text>
          <Text style={styles.statLabel}>total words</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{readyCount}</Text>
          <Text style={styles.statLabel}>ready</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{needsAiCount}</Text>
          <Text style={styles.statLabel}>needs AI</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Words</Text>

          <Pressable onPress={loadWords} disabled={wordsLoading}>
            <Text style={styles.refreshText}>
              {wordsLoading ? "Loading..." : "Refresh"}
            </Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Search words or meanings..."
          autoCapitalize="none"
          value={searchText}
          onChangeText={setSearchText}
        />

        {wordsLoading && words.length === 0 ? (
          <View style={styles.emptyState}>
            <ActivityIndicator />
            <Text style={styles.emptyStateText}>Loading your words...</Text>
          </View>
        ) : filteredWords.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>
              {words.length === 0 ? "No words yet" : "No matches"}
            </Text>
            <Text style={styles.emptyStateText}>
              {words.length === 0
                ? "Add words from Today, then they will appear here."
                : "Try a different search."}
            </Text>
          </View>
        ) : (
          <View style={styles.wordList}>
            {filteredWords.map((item) => {
              const aiReady = hasAiContent(item);

              return (
                <Pressable
                  key={item.id}
                  style={styles.wordItem}
                  onPress={() => openWordDetail(item)}
                >
                  <View style={styles.wordMainContent}>
                    <Text style={styles.wordText}>{getDisplayWord(item)}</Text>

                    <View style={styles.badgeRow}>
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusBadgeText}>
                          {item.status ?? "new"}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.aiBadge,
                          aiReady ? styles.aiReadyBadge : styles.aiMissingBadge,
                        ]}
                      >
                        <Text
                          style={[
                            styles.aiBadgeText,
                            aiReady
                              ? styles.aiReadyBadgeText
                              : styles.aiMissingBadgeText,
                          ]}
                        >
                          {aiReady ? "Practice ready" : "Needs AI"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function getContent(item: UserWord) {
  return Array.isArray(item.word_contents)
    ? item.word_contents[0]
    : item.word_contents;
}

function getDisplayWord(item: UserWord) {
  const content = getContent(item);

  return content?.display_word ?? content?.normalized_word ?? "Untitled word";
}

function hasAiContent(item: UserWord) {
  const content = getContent(item);

  return Boolean(
    content?.turkish_meaning ||
      content?.simple_definition ||
      content?.mini_lesson
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 110,
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
  hero: {
    marginBottom: 20,
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
    fontSize: 34,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 25,
    color: "#64748b",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statNumber: {
    fontSize: 26,
    fontWeight: "900",
    color: "#0f172a",
  },
  statLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "900",
    color: "#64748b",
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0f172a",
  },
  refreshText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#2563eb",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#f8fafc",
    marginBottom: 14,
  },
  wordList: {
    gap: 10,
  },
  wordItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 18,
    padding: 14,
  },
  wordMainContent: {
    flex: 1,
  },
  wordText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 8,
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
  },
  aiReadyBadgeText: {
    color: "#166534",
  },
  aiMissingBadgeText: {
    color: "#92400e",
  },
  chevron: {
    fontSize: 28,
    fontWeight: "900",
    color: "#94a3b8",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 28,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 6,
  },
  emptyStateText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#64748b",
    textAlign: "center",
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
  },
});
