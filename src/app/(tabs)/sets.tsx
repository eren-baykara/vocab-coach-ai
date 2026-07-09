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
import { useWordCorrection } from "../../lib/word-correction-context";
import {
  addUserWord,
  getCorrectionOptions,
  type WordCorrectionSuggestion,
} from "../../lib/wordActions";
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
  ai_content_disabled: boolean | null;
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

type SetFilter = "all" | "active" | "completed";

const WORD_SELECT = `
  id,
  status,
  created_at,
  next_review_at,
  ai_content_disabled,
  word_contents (
    display_word,
    normalized_word,
    simple_definition,
    turkish_meaning,
    mini_lesson
  )
`;

const SET_FILTERS: { key: SetFilter; label: string }[] = [
  { key: "all", label: "Hepsi" },
  { key: "active", label: "Aktif" },
  { key: "completed", label: "Tamamlandı" },
];

const ALL_WORDS_SET_ID = "__all_words__";

const ALL_WORDS_SET: WordSet = {
  id: ALL_WORDS_SET_ID,
  name: "Tüm Kelimeler",
  description: "Set oluşturmadan eklediğin tüm kelimeler",
  created_at: "",
};

function isAllWordsSet(setId: string | null | undefined) {
  return setId === ALL_WORDS_SET_ID;
}

export default function SetsScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [setsLoading, setSetsLoading] = useState(false);
  const [creatingSet, setCreatingSet] = useState(false);
  const [savingRenameId, setSavingRenameId] = useState<string | null>(null);
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null);
  const [savingSetItem, setSavingSetItem] = useState(false);

  const [sets, setSets] = useState<WordSet[]>([]);
  const [setItems, setSetItems] = useState<WordSetItem[]>([]);
  const [words, setWords] = useState<UserWord[]>([]);

  const [newSetName, setNewSetName] = useState("");
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editingSetName, setEditingSetName] = useState("");
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [addWordSearch, setAddWordSearch] = useState("");
  const [setSearchText, setSetSearchText] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<SetFilter>("all");
  const [showCreateBox, setShowCreateBox] = useState(false);
  const [checkingWordCorrection, setCheckingWordCorrection] = useState(false);

  const { queueCorrection, wordsChangeToken } = useWordCorrection();

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

  const loadSetsData = useCallback(async () => {
    if (!session) return;

    setSetsLoading(true);

    const [setsResult, itemsResult, wordsResult] = await Promise.all([
      supabase
        .from("word_sets")
        .select("id, name, description, created_at")
        .order("created_at", { ascending: true }),
      supabase.from("word_set_items").select("id, set_id, user_word_id"),
      supabase
        .from("user_words")
        .select(WORD_SELECT)
        .order("created_at", { ascending: false }),
    ]);

    setSetsLoading(false);

    if (setsResult.error) {
      Alert.alert("Setler yüklenemedi", setsResult.error.message);
      return;
    }

    if (itemsResult.error) {
      Alert.alert("Set kelimeleri yüklenemedi", itemsResult.error.message);
      return;
    }

    if (wordsResult.error) {
      Alert.alert("Kelimeler yüklenemedi", wordsResult.error.message);
      return;
    }

    setSets((setsResult.data ?? []) as WordSet[]);
    setSetItems((itemsResult.data ?? []) as WordSetItem[]);
    setWords((wordsResult.data ?? []) as UserWord[]);
  }, [session]);

  useEffect(() => {
    if (session) {
      loadSetsData();
    } else {
      setSets([]);
      setSetItems([]);
      setWords([]);
    }
  }, [session, loadSetsData]);

  useFocusEffect(
    useCallback(() => {
      if (session) {
        loadSetsData();
      }
    }, [session, loadSetsData])
  );

  useEffect(() => {
    if (session) {
      loadSetsData();
    }
  }, [wordsChangeToken, session, loadSetsData]);

  const expandedSet =
    expandedSetId === ALL_WORDS_SET_ID
      ? ALL_WORDS_SET
      : (sets.find((set) => set.id === expandedSetId) ?? null);

  const showAllWordsSet = useMemo(() => {
    const cleanSearch = setSearchText.trim().toLowerCase();
    const stats = getSetStats(ALL_WORDS_SET_ID);
    const isCompleted = stats.total > 0 && stats.learned === stats.total;

    const matchesSearch =
      !cleanSearch ||
      ALL_WORDS_SET.name.toLowerCase().includes(cleanSearch) ||
      (ALL_WORDS_SET.description?.toLowerCase().includes(cleanSearch) ?? false);

    const matchesFilter =
      selectedFilter === "all" ||
      (selectedFilter === "completed" && isCompleted) ||
      (selectedFilter === "active" && !isCompleted);

    return matchesSearch && matchesFilter;
  }, [words, setSearchText, selectedFilter, setItems]);

  const filteredSets = useMemo(() => {
    const cleanSearch = setSearchText.trim().toLowerCase();

    return sets.filter((set) => {
      const stats = getSetStats(set.id);
      const isCompleted = stats.total > 0 && stats.learned === stats.total;

      const matchesSearch =
        !cleanSearch ||
        set.name.toLowerCase().includes(cleanSearch) ||
        (set.description?.toLowerCase().includes(cleanSearch) ?? false);

      const matchesFilter =
        selectedFilter === "all" ||
        (selectedFilter === "completed" && isCompleted) ||
        (selectedFilter === "active" && !isCompleted);

      return matchesSearch && matchesFilter;
    });
  }, [sets, setItems, words, setSearchText, selectedFilter]);

  const addableWords = useMemo(() => {
    if (!expandedSet || isAllWordsSet(expandedSet.id)) return [];

    const cleanSearch = addWordSearch.trim().toLowerCase();
    const currentWordIds = new Set(
      setItems
        .filter((item) => item.set_id === expandedSet.id)
        .map((item) => item.user_word_id)
    );

    return words
      .filter((item) => !currentWordIds.has(item.id))
      .filter((item) => {
        if (!cleanSearch) return false;

        const content = getContent(item);
        const displayWord = content?.display_word?.toLowerCase() ?? "";
        const normalizedWord = content?.normalized_word?.toLowerCase() ?? "";
        const meaning = item.ai_content_disabled
          ? ""
          : content?.turkish_meaning?.toLowerCase() ?? "";
        const definition = item.ai_content_disabled
          ? ""
          : content?.simple_definition?.toLowerCase() ?? "";

        return (
          displayWord.includes(cleanSearch) ||
          normalizedWord.includes(cleanSearch) ||
          meaning.includes(cleanSearch) ||
          definition.includes(cleanSearch)
        );
      })
      .slice(0, 8);
  }, [expandedSet, addWordSearch, setItems, words]);

  async function handleCreateSet() {
    const cleanName = newSetName.trim();

    if (!cleanName) {
      Alert.alert("Set adı eksik", "Lütfen bir set adı gir.");
      return;
    }

    setCreatingSet(true);

    const { data, error } = await supabase
      .from("word_sets")
      .insert({
        name: cleanName,
      })
      .select("id, name, description, created_at")
      .single();

    setCreatingSet(false);

    if (error) {
      Alert.alert("Set oluşturulamadı", error.message);
      return;
    }

    setNewSetName("");
    setShowCreateBox(false);
    setExpandedSetId(data.id);
    await loadSetsData();
  }

  function startEditingSet(set: WordSet) {
    setEditingSetId(set.id);
    setEditingSetName(set.name);
  }

  function cancelEditingSet() {
    setEditingSetId(null);
    setEditingSetName("");
  }

  async function saveSetName(set: WordSet) {
    const cleanName = editingSetName.trim();

    if (!cleanName) {
      Alert.alert("Set adı eksik", "Set adı boş olamaz.");
      return;
    }

    setSavingRenameId(set.id);

    const { error } = await supabase
      .from("word_sets")
      .update({
        name: cleanName,
      })
      .eq("id", set.id);

    setSavingRenameId(null);

    if (error) {
      Alert.alert("Set adı değiştirilemedi", error.message);
      return;
    }

    cancelEditingSet();
    await loadSetsData();
  }

  function confirmDeleteSet(set: WordSet) {
    if (isAllWordsSet(set.id)) return;

    Alert.alert(
      "Set silinsin mi?",
      `"${set.name}" silinecek. Kelimelerin Library içinde kalır.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Seti sil",
          style: "destructive",
          onPress: () => deleteSet(set),
        },
      ]
    );
  }

  async function deleteSet(set: WordSet) {
    setDeletingSetId(set.id);

    const { error } = await supabase.from("word_sets").delete().eq("id", set.id);

    setDeletingSetId(null);

    if (error) {
      Alert.alert("Set silinemedi", error.message);
      return;
    }

    if (editingSetId === set.id) cancelEditingSet();
    if (expandedSetId === set.id) setExpandedSetId(null);

    await loadSetsData();
  }

  function toggleSetDetails(set: WordSet) {
    const nextExpandedSetId = expandedSetId === set.id ? null : set.id;

    setExpandedSetId(nextExpandedSetId);
    setAddWordSearch("");
    cancelEditingSet();
  }

  async function handleAddWordToExpandedSet() {
    if (!expandedSetId) return;

    const cleanWord = addWordSearch.trim();

    if (!cleanWord) {
      Alert.alert("Kelime eksik", "Bu sete eklemek için bir kelime yaz.");
      return;
    }

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
      await addWordToExpandedSetConfirmed(cleanWord);
      return;
    }

    const suggestion = data as WordCorrectionSuggestion | null;
    const correctionOptions = suggestion
      ? getCorrectionOptions(suggestion, cleanWord)
      : [];

    if (suggestion?.should_confirm && correctionOptions.length > 0) {
      setAddWordSearch("");

      queueCorrection({
        originalWord: cleanWord,
        suggestion,
        generateAiAfterAdd: true,
        setId: isAllWordsSet(expandedSetId) ? null : expandedSetId,
      });

      return;
    }

    await addWordToExpandedSetConfirmed(cleanWord);
  }

  async function addWordToExpandedSetConfirmed(cleanWord: string) {
    if (!expandedSetId) return;

    setSavingSetItem(true);

    const targetWord = await addUserWord(cleanWord, {
      generateAi: true,
      setId: isAllWordsSet(expandedSetId) ? null : expandedSetId,
    });

    setSavingSetItem(false);

    if (!targetWord) return;

    setAddWordSearch("");
    await loadSetsData();
  }

  async function addExistingWordToSet(wordId: string) {
    if (!expandedSetId || isAllWordsSet(expandedSetId)) return;

    setSavingSetItem(true);

    const { error } = await supabase.from("word_set_items").insert({
      set_id: expandedSetId,
      user_word_id: wordId,
    });

    setSavingSetItem(false);

    if (error && error.code !== "23505") {
      Alert.alert("Kelime eklenemedi", error.message);
      return;
    }

    setAddWordSearch("");
    await loadSetsData();
  }

  function confirmRemoveWordFromSet(word: UserWord) {
    if (!expandedSet) return;

    Alert.alert(
      "Setten çıkarılsın mı?",
      `"${getDisplayWord(word)}", "${expandedSet.name}" setinden çıkarılacak. Kelime Library içinde kalır.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Çıkar",
          style: "destructive",
          onPress: () => removeWordFromSet(word.id),
        },
      ]
    );
  }

  async function removeWordFromSet(wordId: string) {
    if (!expandedSetId) return;

    setSavingSetItem(true);

    const { error } = await supabase
      .from("word_set_items")
      .delete()
      .eq("set_id", expandedSetId)
      .eq("user_word_id", wordId);

    setSavingSetItem(false);

    if (error) {
      Alert.alert("Kelime çıkarılamadı", error.message);
      return;
    }

    await loadSetsData();
  }

  function openWordDetail(word: UserWord) {
    router.push({
      pathname: "/word/[id]",
      params: { id: word.id },
    });
  }

  function getWordsForSet(setId: string) {
    if (isAllWordsSet(setId)) return words;

    const wordIds = new Set(
      setItems
        .filter((item) => item.set_id === setId)
        .map((item) => item.user_word_id)
    );

    return words.filter((item) => wordIds.has(item.id));
  }

  function getSetStats(setId: string) {
    const scopedWords = getWordsForSet(setId);
    const readyWords = scopedWords.filter(hasAiContent);
    const reviewTodayWords = readyWords.filter(isDue);
    const learnedWords = scopedWords.filter(isLearnedWord);

    return {
      total: scopedWords.length,
      ready: readyWords.length,
      reviewToday: reviewTodayWords.length,
      learned: learnedWords.length,
    };
  }

  if (initialLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={styles.loadingText}>Setlerin yükleniyor...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.emptyTitle}>Önce giriş yap</Text>
        <Text style={styles.emptyText}>
          Çalışma setlerin giriş yaptıktan sonra burada görünecek.
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
        <Text style={styles.title}>Setlerim</Text>

        <Pressable
          style={styles.addButton}
          onPress={() => setShowCreateBox((current) => !current)}
        >
          <Text style={styles.addButtonText}>＋</Text>
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Set ara..."
          placeholderTextColor={theme.colors.textMuted}
          value={setSearchText}
          onChangeText={setSetSearchText}
        />
      </View>

      <View style={styles.filterRow}>
        {SET_FILTERS.map((filter) => {
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
              >
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {showCreateBox ? (
        <View style={styles.createPanel}>
          <Text style={styles.createTitle}>Yeni set oluştur</Text>
          <Text style={styles.createText}>
            TOEFL, Akademik İngilizce veya Günlük Konuşmalar gibi odaklı setler oluştur.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Örn: TOEFL kelimeleri"
            placeholderTextColor={theme.colors.textMuted}
            value={newSetName}
            onChangeText={setNewSetName}
            editable={!creatingSet}
            onSubmitEditing={handleCreateSet}
          />

          <Pressable
            style={[styles.primaryButton, creatingSet && styles.disabledButton]}
            onPress={handleCreateSet}
            disabled={creatingSet}
          >
            <Text style={styles.primaryButtonText}>
              {creatingSet ? "Oluşturuluyor..." : "Set oluştur"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {setsLoading && words.length === 0 && sets.length === 0 ? (
        <View style={styles.emptyCard}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.emptyStateText}>Setlerin yükleniyor...</Text>
        </View>
      ) : !showAllWordsSet && filteredSets.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyStateTitle}>
            {words.length === 0 && sets.length === 0
              ? "Henüz kelime yok"
              : "Sonuç bulunamadı"}
          </Text>
          <Text style={styles.emptyStateText}>
            {words.length === 0 && sets.length === 0
              ? "Bugün ekranından kelime eklediğinde Tüm Kelimeler setinde görünecek."
              : "Farklı bir arama veya filtre deneyebilirsin."}
          </Text>
        </View>
      ) : (
        <View style={styles.setList}>
          {showAllWordsSet
            ? renderSetCard(ALL_WORDS_SET, 0, { isVirtual: true })
            : null}

          {filteredSets.map((set, index) =>
            renderSetCard(set, showAllWordsSet ? index + 1 : index)
          )}
        </View>
      )}
    </ScrollView>
  );

  function renderSetCard(
    set: WordSet,
    index: number,
    options: { isVirtual?: boolean } = {}
  ) {
    const { isVirtual = false } = options;
    const stats = getSetStats(set.id);
    const isEditing = !isVirtual && editingSetId === set.id;
    const isExpanded = expandedSetId === set.id;
    const savingThisSet = savingRenameId === set.id;
    const deletingThisSet = deletingSetId === set.id;
    const progress = getSetProgress(stats.total, stats.learned);
    const progressWidth = `${progress}%` as `${number}%`;
    const isCompleted = stats.total > 0 && stats.learned === stats.total;
    const accent = getSetAccent(index);
    const setWords = isExpanded ? getWordsForSet(set.id) : [];

    return (
      <View key={set.id} style={styles.setCard}>
        <Pressable
          style={styles.setCardHeader}
          onPress={() => toggleSetDetails(set)}
        >
          <View style={[styles.setIcon, accent.iconStyle]}>
            <Text style={styles.setIconText}>
              {isVirtual ? "📚" : getSetIcon(set.name, index)}
            </Text>
          </View>

          <View style={styles.setMain}>
            <View style={styles.setTitleRow}>
              <Text style={styles.setTitle} numberOfLines={2}>
                {set.name}
              </Text>

              {isVirtual ? (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultBadgeText}>Varsayılan</Text>
                </View>
              ) : isCompleted ? (
                <View style={styles.completedBadge}>
                  <Text style={styles.completedBadgeText}>Tamamlandı</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.setMeta}>
              {isVirtual
                ? `${stats.total} kelime • set oluşturmadan eklenenler`
                : `${stats.total} kelime`}
            </Text>

            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    accent.progressStyle,
                    { width: progressWidth },
                  ]}
                />
              </View>

              <Text style={styles.progressText}>{progress}%</Text>
            </View>
          </View>
        </Pressable>

        {isExpanded ? (
          <View style={styles.expandedBox}>
            {!isVirtual ? (
              <View style={styles.actionRow}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => startEditingSet(set)}
                >
                  <Text style={styles.secondaryButtonText}>Adı düzenle</Text>
                </Pressable>

                <Pressable
                  style={[styles.dangerButton, deletingThisSet && styles.disabledButton]}
                  onPress={() => confirmDeleteSet(set)}
                  disabled={deletingThisSet}
                >
                  <Text style={styles.dangerButtonText}>
                    {deletingThisSet ? "Siliniyor..." : "Sil"}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.virtualSetHint}>
                Burada tüm kelimelerin görünür. İstersen + ile özel set
                oluşturup kelimeleri gruplayabilirsin.
              </Text>
            )}

            {isEditing ? (
              <View style={styles.editBox}>
                <TextInput
                  style={styles.input}
                  placeholder="Set adı"
                  placeholderTextColor={theme.colors.textMuted}
                  value={editingSetName}
                  onChangeText={setEditingSetName}
                  editable={!savingThisSet && !deletingThisSet}
                  onSubmitEditing={() => saveSetName(set)}
                />

                <View style={styles.actionRow}>
                  <Pressable
                    style={[
                      styles.primaryButton,
                      (savingThisSet || deletingThisSet) && styles.disabledButton,
                    ]}
                    onPress={() => saveSetName(set)}
                    disabled={savingThisSet || deletingThisSet}
                  >
                    <Text style={styles.primaryButtonText}>
                      {savingThisSet ? "Kaydediliyor..." : "Kaydet"}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.secondaryButton}
                    onPress={cancelEditingSet}
                    disabled={savingThisSet || deletingThisSet}
                  >
                    <Text style={styles.secondaryButtonText}>Vazgeç</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <Text style={styles.contentsTitle}>Set içeriği</Text>

            {setWords.length === 0 ? (
              <View style={styles.emptyMiniState}>
                <Text style={styles.emptyMiniTitle}>Henüz kelime yok</Text>
                <Text style={styles.emptyMiniText}>
                  {isVirtual
                    ? "Bugün ekranından veya aşağıdan kelime ekleyebilirsin."
                    : "Aşağıdan kelime ekleyebilirsin."}
                </Text>
              </View>
            ) : (
              <View style={styles.wordList}>
                {setWords.map((word) => (
                  <View key={word.id} style={styles.wordRow}>
                    <Pressable
                      style={styles.wordInfo}
                      onPress={() => openWordDetail(word)}
                    >
                      <Text style={styles.wordText}>{getDisplayWord(word)}</Text>
                      <Text style={styles.wordMeta}>
                        {word.status ?? "yeni"} •{" "}
                        {word.ai_content_disabled
                          ? "AI kapalı"
                          : hasAiContent(word)
                            ? "AI hazır"
                            : "AI bekliyor"}
                      </Text>
                    </Pressable>

                    {!isVirtual ? (
                      <Pressable
                        style={[
                          styles.removeWordButton,
                          savingSetItem && styles.disabledButton,
                        ]}
                        onPress={() => confirmRemoveWordFromSet(word)}
                        disabled={savingSetItem}
                      >
                        <Text style={styles.removeWordButtonText}>Çıkar</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            )}

            <View style={styles.addWordsBox}>
              <Text style={styles.contentsTitle}>
                {isVirtual ? "Yeni kelime ekle" : "Bu sete kelime ekle"}
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Örn: usually"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                value={addWordSearch}
                onChangeText={setAddWordSearch}
                editable={!savingSetItem && !checkingWordCorrection}
                onSubmitEditing={handleAddWordToExpandedSet}
              />

              <Pressable
                style={[
                  styles.primaryButton,
                  (savingSetItem || checkingWordCorrection) && styles.disabledButton,
                ]}
                onPress={handleAddWordToExpandedSet}
                disabled={savingSetItem || checkingWordCorrection}
              >
                <Text style={styles.primaryButtonText}>
                  {checkingWordCorrection
                    ? "Kontrol ediliyor..."
                    : savingSetItem
                      ? "Ekleniyor..."
                      : isVirtual
                        ? "Kelime ekle"
                        : "Sete ekle"}
                </Text>
              </Pressable>

              {!isVirtual && addableWords.length > 0 ? (
                <View style={styles.addableSuggestionBlock}>
                  <Text style={styles.suggestionLabel}>Library eşleşmeleri</Text>

                  <View style={styles.addableList}>
                    {addableWords.map((word) => (
                      <Pressable
                        key={word.id}
                        style={[
                          styles.addableWordRow,
                          savingSetItem && styles.disabledButton,
                        ]}
                        onPress={() => addExistingWordToSet(word.id)}
                        disabled={savingSetItem}
                      >
                        <Text style={styles.addableWordText}>
                          + {getDisplayWord(word)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    );
  }
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

function hasAiContent(item: UserWord) {
  if (item.ai_content_disabled) return false;

  const content = getContent(item);

  return Boolean(
    content?.turkish_meaning ||
      content?.simple_definition ||
      content?.mini_lesson
  );
}

function isDue(item: UserWord) {
  if (!item.next_review_at) return true;

  return new Date(item.next_review_at) <= new Date();
}

function isLearnedWord(item: UserWord) {
  const status = (item.status ?? "").toLowerCase();

  return (
    status.includes("learned") ||
    status.includes("known") ||
    status.includes("mastered") ||
    status.includes("completed") ||
    status.includes("öğren") ||
    status.includes("ogren")
  );
}

function getSetProgress(total: number, learned: number) {
  if (total <= 0) return 0;

  return Math.round((learned / total) * 100);
}

function getSetIcon(name: string, index: number) {
  const cleanName = name.toLowerCase();

  if (cleanName.includes("konuş") || cleanName.includes("daily")) return "💬";
  if (cleanName.includes("akadem") || cleanName.includes("toefl")) return "🎓";
  if (cleanName.includes("seyahat") || cleanName.includes("travel")) return "✈️";
  if (cleanName.includes("mistake") || cleanName.includes("hata")) return "✍️";

  return ["📚", "🧠", "✨"][index % 3];
}

function getSetAccent(index: number) {
  const accents = [
    {
      iconStyle: styles.iconWarm,
      progressStyle: styles.progressWarm,
    },
    {
      iconStyle: styles.iconSoft,
      progressStyle: styles.progressWarm,
    },
    {
      iconStyle: styles.iconGreen,
      progressStyle: styles.progressGreen,
    },
  ];

  return accents[index % accents.length];
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 30,
    paddingTop: 42,
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
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
  },
  addButtonText: {
    color: theme.colors.textInverse,
    fontSize: 25,
    fontWeight: "800",
    lineHeight: 28,
  },
  searchBox: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 13,
    backgroundColor: theme.colors.surfaceSoft,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.textMuted,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    padding: 0,
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text,
  },
  filterRow: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: theme.colors.surfaceSoft,
    paddingHorizontal: 14,
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
  createPanel: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 16,
    marginBottom: 14,
    ...theme.shadow.card,
  },
  createTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 5,
  },
  createText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: theme.colors.textMuted,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceMuted,
    marginBottom: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: theme.colors.textInverse,
    fontSize: 14,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.55,
  },
  setList: {
    gap: 11,
  },
  setCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 16,
    ...theme.shadow.card,
  },
  setCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  setIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  setIconText: {
    fontSize: 23,
  },
  iconWarm: {
    backgroundColor: theme.colors.surfaceSoft,
  },
  iconSoft: {
    backgroundColor: theme.colors.primarySurface,
  },
  iconGreen: {
    backgroundColor: theme.colors.successSoft,
  },
  setMain: {
    flex: 1,
    minWidth: 0,
  },
  setTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 3,
  },
  setTitle: {
    flex: 1,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900",
    color: theme.colors.text,
  },
  setMeta: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.textMuted,
    marginBottom: 10,
  },
  completedBadge: {
    borderRadius: 7,
    backgroundColor: theme.colors.successSoft,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  completedBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: theme.colors.successDark,
  },
  defaultBadge: {
    borderRadius: 7,
    backgroundColor: theme.colors.primarySurface,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: theme.colors.primaryDark,
  },
  virtualSetHint: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: theme.colors.textMuted,
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceSoft,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: theme.radius.pill,
  },
  progressWarm: {
    backgroundColor: theme.colors.primary,
  },
  progressGreen: {
    backgroundColor: theme.colors.success,
  },
  progressText: {
    width: 33,
    fontSize: 12,
    fontWeight: "900",
    color: theme.colors.textMuted,
    textAlign: "right",
  },
  expandedBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSoft,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "900",
  },
  dangerButton: {
    flex: 1,
    backgroundColor: theme.colors.dangerSoft,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  dangerButtonText: {
    color: theme.colors.dangerDark,
    fontSize: 13,
    fontWeight: "900",
  },
  editBox: {
    marginBottom: 12,
  },
  contentsTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 10,
  },
  emptyMiniState: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
  },
  emptyMiniTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 4,
  },
  emptyMiniText: {
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textMuted,
  },
  wordList: {
    gap: 8,
    marginBottom: 14,
  },
  wordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
  },
  wordInfo: {
    flex: 1,
  },
  wordText: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 3,
  },
  wordMeta: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.textMuted,
  },
  removeWordButton: {
    backgroundColor: theme.colors.dangerSoft,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  removeWordButtonText: {
    fontSize: 12,
    fontWeight: "900",
    color: theme.colors.dangerDark,
  },
  addWordsBox: {
    marginTop: 4,
  },
  addableSuggestionBlock: {
    marginTop: 14,
  },
  suggestionLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  addableList: {
    gap: 8,
  },
  addableWordRow: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
  },
  addableWordText: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.primary,
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
