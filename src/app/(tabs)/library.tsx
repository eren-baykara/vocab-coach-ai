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
import { theme } from "../../theme";

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

type LearningFilter = "all" | "learned" | "studying" | "new";
type LearningState = Exclude<LearningFilter, "all">;

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

const FILTERS: { key: LearningFilter; label: string }[] = [
  { key: "all", label: "Hepsi" },
  { key: "learned", label: "Öğrenildi" },
  { key: "studying", label: "Çalışıyor" },
  { key: "new", label: "Yeni" },
];

export default function LibraryScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [wordsLoading, setWordsLoading] = useState(false);
  const [words, setWords] = useState<UserWord[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<LearningFilter>("all");

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
      Alert.alert("Kelimeler yüklenemedi", error.message);
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

    return words.filter((item) => {
      const content = getContent(item);
      const displayWord = content?.display_word?.toLowerCase() ?? "";
      const normalizedWord = content?.normalized_word?.toLowerCase() ?? "";
      const meaning = content?.turkish_meaning?.toLowerCase() ?? "";
      const definition = content?.simple_definition?.toLowerCase() ?? "";

      const matchesSearch =
        !cleanSearch ||
        displayWord.includes(cleanSearch) ||
        normalizedWord.includes(cleanSearch) ||
        meaning.includes(cleanSearch) ||
        definition.includes(cleanSearch);

      const matchesFilter =
        selectedFilter === "all" || getLearningState(item) === selectedFilter;

      return matchesSearch && matchesFilter;
    });
  }, [words, searchText, selectedFilter]);

  const totalLabel = `${words.length.toLocaleString("tr-TR")} kelime`;

  function openWordDetail(item: UserWord) {
    router.push({
      pathname: "/word/[id]",
      params: { id: item.id },
    });
  }

  if (initialLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={styles.loadingText}>Kelimelerin yükleniyor...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.emptyTitle}>Önce giriş yap</Text>
        <Text style={styles.emptyText}>
          Kaydettiğin kelimeler giriş yaptıktan sonra burada görünecek.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Kelimelerim</Text>

        <Pressable
          style={styles.countPill}
          onPress={loadWords}
          disabled={wordsLoading}
        >
          <Text style={styles.countText}>
            {wordsLoading ? "Yükleniyor" : totalLabel}
          </Text>
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.input}
          placeholder="Kelime veya anlam ara..."
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      <View style={styles.filterRow}>
  {FILTERS.map((filter) => {
    const isActive = selectedFilter === filter.key;

    return (
      <Pressable
        key={filter.key}
        style={[styles.filterChip, isActive && styles.filterChipActive]}
        onPress={() => setSelectedFilter(filter.key)}
      >
        <Text
          style={[
            styles.filterChipText,
            isActive && styles.filterChipTextActive,
          ]}
          numberOfLines={1}
        >
          {filter.label}
        </Text>
      </Pressable>
    );
  })}
</View>

      {wordsLoading && words.length === 0 ? (
        <View style={styles.emptyCard}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.emptyStateText}>Kelimelerin yükleniyor...</Text>
        </View>
      ) : filteredWords.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyStateTitle}>
            {words.length === 0 ? "Henüz kelime yok" : "Sonuç bulunamadı"}
          </Text>
          <Text style={styles.emptyStateText}>
            {words.length === 0
              ? "Bugün ekranından kelime eklediğinde burada görünecek."
              : "Farklı bir kelime, anlam veya filtre deneyebilirsin."}
          </Text>
        </View>
      ) : (
        <View style={styles.wordList}>
          {filteredWords.map((item) => {
            const learningState = getLearningState(item);
            const statusMeta = getStatusMeta(learningState);
            const primaryMeaning = getPrimaryMeaning(item);
            const secondaryText = getSecondaryText(item);

            return (
              <Pressable
                key={item.id}
                style={styles.wordCard}
                onPress={() => openWordDetail(item)}
              >
                <View style={[styles.partBadge, statusMeta.partStyle]}>
                  <Text style={[styles.partBadgeText, statusMeta.partTextStyle]}>
                    KLM
                  </Text>
                </View>

                <View style={styles.wordMainContent}>
                  <Text style={styles.wordText} numberOfLines={1}>
                    {getDisplayWord(item)}
                  </Text>

                  <Text style={styles.meaningText} numberOfLines={1}>
                    {primaryMeaning || "Anlam bilgisi bekleniyor"}
                  </Text>

                  {secondaryText ? (
                    <Text style={styles.definitionText} numberOfLines={1}>
                      {secondaryText}
                    </Text>
                  ) : null}
                </View>

                <View style={[styles.statusBadge, statusMeta.badgeStyle]}>
                  <Text style={[styles.statusBadgeText, statusMeta.textStyle]}>
                    {statusMeta.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
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

  return content?.display_word ?? content?.normalized_word ?? "İsimsiz kelime";
}

function getPrimaryMeaning(item: UserWord) {
  const content = getContent(item);

  return content?.turkish_meaning ?? "";
}

function getSecondaryText(item: UserWord) {
  const content = getContent(item);

  return content?.simple_definition ?? content?.mini_lesson ?? "";
}

function getLearningState(item: UserWord): LearningState {
  const status = (item.status ?? "").toLowerCase();

  if (
    status.includes("learned") ||
    status.includes("known") ||
    status.includes("mastered") ||
    status.includes("completed") ||
    status.includes("öğren") ||
    status.includes("ogren")
  ) {
    return "learned";
  }

  if (
    status.includes("learning") ||
    status.includes("review") ||
    status.includes("study") ||
    status.includes("studying") ||
    status.includes("active") ||
    status.includes("progress") ||
    status.includes("due") ||
    status.includes("çalış") ||
    status.includes("calis")
  ) {
    return "studying";
  }

  return "new";
}

function getStatusMeta(state: LearningState) {
  switch (state) {
    case "learned":
      return {
        label: "Öğrenildi",
        badgeStyle: styles.statusLearned,
        textStyle: styles.statusLearnedText,
        partStyle: styles.partLearned,
        partTextStyle: styles.partLearnedText,
      };
    case "studying":
      return {
        label: "Çalışıyor",
        badgeStyle: styles.statusStudying,
        textStyle: styles.statusStudyingText,
        partStyle: styles.partStudying,
        partTextStyle: styles.partStudyingText,
      };
    default:
      return {
        label: "Yeni",
        badgeStyle: styles.statusNew,
        textStyle: styles.statusNewText,
        partStyle: styles.partNew,
        partTextStyle: styles.partNewText,
      };
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 17,
    paddingTop: 38,
    paddingBottom: 110,
  },
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing["2xl"],
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.textMuted,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 23,
    fontWeight: "900",
    color: theme.colors.text,
    letterSpacing: -0.4,
  },
  countPill: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceSoft,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  countText: {
    fontSize: 12,
    fontWeight: "900",
    color: theme.colors.textMuted,
  },
  searchBox: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceSoft,
    paddingHorizontal: 13,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.textMuted,
  },
  input: {
    flex: 1,
    height: "100%",
    padding: 0,
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.text,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 32,
    marginBottom: 14,
  },
  filterChip: {
    width: 88,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceSoft,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "900",
    color: theme.colors.textMuted,
  },
  filterChipTextActive: {
    color: theme.colors.textInverse,
  },
  wordList: {
    gap: 10,
  },
  wordCard: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 13,
    ...theme.shadow.card,
  },
  partBadge: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  partBadgeText: {
    fontSize: 10,
    fontWeight: "900",
  },
  partLearned: {
    backgroundColor: theme.colors.successSoft,
  },
  partLearnedText: {
    color: theme.colors.successDark,
  },
  partStudying: {
    backgroundColor: theme.colors.primarySurface,
  },
  partStudyingText: {
    color: theme.colors.primary,
  },
  partNew: {
    backgroundColor: theme.colors.accentSoft,
  },
  partNewText: {
    color: theme.colors.accent,
  },
  wordMainContent: {
    flex: 1,
    minWidth: 0,
  },
  wordText: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  meaningText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.textMuted,
    lineHeight: 17,
  },
  definitionText: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.textMuted,
    lineHeight: 17,
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },
  statusLearned: {
    backgroundColor: theme.colors.successSoft,
  },
  statusLearnedText: {
    color: theme.colors.successDark,
  },
  statusStudying: {
    backgroundColor: theme.colors.warningSoft,
  },
  statusStudyingText: {
    color: theme.colors.warningDark,
  },
  statusNew: {
    backgroundColor: theme.colors.accentSoft,
  },
  statusNewText: {
    color: theme.colors.accent,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing["3xl"],
    ...theme.shadow.card,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 6,
    textAlign: "center",
  },
  emptyStateText: {
    marginTop: theme.spacing.sm,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
});
