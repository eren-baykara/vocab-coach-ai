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

const WORD_SELECT = `
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
      Alert.alert("Could not load sets", setsResult.error.message);
      return;
    }

    if (itemsResult.error) {
      Alert.alert("Could not load set words", itemsResult.error.message);
      return;
    }

    if (wordsResult.error) {
      Alert.alert("Could not load words", wordsResult.error.message);
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

  const expandedSet = sets.find((set) => set.id === expandedSetId) ?? null;
  const expandedSetWords = expandedSet ? getWordsForSet(expandedSet.id) : [];

  const addableWords = useMemo(() => {
    if (!expandedSet) return [];

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
        const meaning = content?.turkish_meaning?.toLowerCase() ?? "";
        const definition = content?.simple_definition?.toLowerCase() ?? "";

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
      Alert.alert("Missing set name", "Please enter a set name.");
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
      Alert.alert("Could not create set", error.message);
      return;
    }

    setNewSetName("");
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
      Alert.alert("Missing set name", "Set name cannot be empty.");
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
      Alert.alert("Could not rename set", error.message);
      return;
    }

    cancelEditingSet();
    await loadSetsData();
  }

  function confirmDeleteSet(set: WordSet) {
    Alert.alert(
      "Delete set?",
      `This will delete "${set.name}". Your words will stay in Library.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete set",
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
      Alert.alert("Could not delete set", error.message);
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
      Alert.alert("Missing word", "Type a word to add to this set.");
      return;
    }

    setSavingSetItem(true);

    const { error: addWordError } = await supabase.rpc("add_user_word", {
      input_word: cleanWord,
    });

    if (addWordError) {
      setSavingSetItem(false);
      Alert.alert("Could not add word", addWordError.message);
      return;
    }

    const targetWord = await findUserWordByInput(cleanWord);

    if (!targetWord) {
      setSavingSetItem(false);
      Alert.alert(
        "Word added",
        "The word was added to your Library, but I could not attach it to this set."
      );
      await loadSetsData();
      return;
    }

    const { error: setError } = await supabase.from("word_set_items").insert({
      set_id: expandedSetId,
      user_word_id: targetWord.id,
    });

    setSavingSetItem(false);

    if (setError && setError.code !== "23505") {
      Alert.alert("Word added, but could not add it to set", setError.message);
      return;
    }

    setAddWordSearch("");
    await loadSetsData();
  }

  async function addExistingWordToSet(wordId: string) {
    if (!expandedSetId) return;

    setSavingSetItem(true);

    const { error } = await supabase.from("word_set_items").insert({
      set_id: expandedSetId,
      user_word_id: wordId,
    });

    setSavingSetItem(false);

    if (error && error.code !== "23505") {
      Alert.alert("Could not add word", error.message);
      return;
    }

    setAddWordSearch("");
    await loadSetsData();
  }

  function confirmRemoveWordFromSet(word: UserWord) {
    if (!expandedSet) return;

    Alert.alert(
      "Remove from set?",
      `Remove "${getDisplayWord(word)}" from "${expandedSet.name}"? The word will stay in Library.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
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
      Alert.alert("Could not remove word", error.message);
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

  async function findUserWordByInput(inputWord: string) {
    const normalizedInput = inputWord.trim().toLowerCase();

    const { data, error } = await supabase
      .from("user_words")
      .select(WORD_SELECT)
      .order("created_at", { ascending: false });

    if (error) {
      Alert.alert("Could not find word", error.message);
      return null;
    }

    const typedWords = (data ?? []) as UserWord[];

    return (
      typedWords.find((item) => {
        const content = getContent(item);

        const displayWord = content?.display_word?.trim().toLowerCase();
        const normalizedWord = content?.normalized_word?.trim().toLowerCase();

        return displayWord === normalizedInput || normalizedWord === normalizedInput;
      }) ?? null
    );
  }

  function getWordsForSet(setId: string) {
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

    return {
      total: scopedWords.length,
      ready: readyWords.length,
      reviewToday: reviewTodayWords.length,
    };
  }

  if (initialLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading sets...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.emptyTitle}>Log in first</Text>
        <Text style={styles.emptyText}>
          Your study sets will appear here after you log in.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Sets</Text>
        <Text style={styles.title}>Manage study sets</Text>
        <Text style={styles.subtitle}>
          Create focused groups, add words from Library, and keep each set clean.
          Start quizzes from Today.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Create a set</Text>
        <Text style={styles.helperText}>
          Use sets for goals like TOEFL, Daily English, My Mistakes, or Still
          Learning.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Example: TOEFL, Daily English..."
          value={newSetName}
          onChangeText={setNewSetName}
          editable={!creatingSet}
          onSubmitEditing={handleCreateSet}
        />

        <Pressable
          style={[styles.button, creatingSet && styles.disabledButton]}
          onPress={handleCreateSet}
          disabled={creatingSet}
        >
          <Text style={styles.buttonText}>
            {creatingSet ? "Creating..." : "Create set"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your sets</Text>

          <Pressable onPress={loadSetsData} disabled={setsLoading}>
            <Text style={styles.refreshText}>
              {setsLoading ? "Loading..." : "Refresh"}
            </Text>
          </Pressable>
        </View>

        {setsLoading && sets.length === 0 ? (
          <View style={styles.emptyState}>
            <ActivityIndicator />
            <Text style={styles.emptyStateText}>Loading your sets...</Text>
          </View>
        ) : sets.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No sets yet</Text>
            <Text style={styles.emptyStateText}>
              Create your first set, then add words from Library.
            </Text>
          </View>
        ) : (
          <View style={styles.setList}>
            {sets.map((set) => {
              const stats = getSetStats(set.id);
              const isEditing = editingSetId === set.id;
              const isExpanded = expandedSetId === set.id;
              const savingThisSet = savingRenameId === set.id;
              const deletingThisSet = deletingSetId === set.id;

              return (
                <View key={set.id} style={styles.setCard}>
                  <Pressable
                    style={styles.setCardHeader}
                    onPress={() => toggleSetDetails(set)}
                  >
                    <View style={styles.setTitleWrap}>
                      <Text style={styles.setTitle}>{set.name}</Text>
                      <Text style={styles.setMeta}>
                        {stats.total} words • {stats.ready} ready •{" "}
                        {stats.reviewToday} review today
                      </Text>
                    </View>

                    <View style={styles.iconActions}>
                      <Pressable
                        style={styles.iconButton}
                        onPress={() => startEditingSet(set)}
                      >
                        <Text style={styles.iconButtonText}>✎</Text>
                      </Pressable>

                      <Pressable
                        style={[styles.iconButton, styles.deleteIconButton]}
                        onPress={() => confirmDeleteSet(set)}
                        disabled={deletingThisSet}
                      >
                        <Text
                          style={[
                            styles.iconButtonText,
                            styles.deleteIconButtonText,
                          ]}
                        >
                          ×
                        </Text>
                      </Pressable>
                    </View>
                  </Pressable>

                  <View style={styles.statsRow}>
                    <View style={styles.statPill}>
                      <Text style={styles.statNumber}>{stats.total}</Text>
                      <Text style={styles.statLabel}>words</Text>
                    </View>

                    <View style={styles.statPill}>
                      <Text style={styles.statNumber}>{stats.ready}</Text>
                      <Text style={styles.statLabel}>ready</Text>
                    </View>

                    <View style={styles.statPill}>
                      <Text style={styles.statNumber}>{stats.reviewToday}</Text>
                      <Text style={styles.statLabel}>today</Text>
                    </View>
                  </View>

                  <Pressable
                    style={styles.detailsToggle}
                    onPress={() => toggleSetDetails(set)}
                  >
                    <Text style={styles.detailsToggleText}>
                      {isExpanded ? "Hide set contents" : "View and edit words"}
                    </Text>
                  </Pressable>

                  {isEditing ? (
                    <View style={styles.editBox}>
                      <TextInput
                        style={styles.input}
                        placeholder="Set name"
                        value={editingSetName}
                        onChangeText={setEditingSetName}
                        editable={!savingThisSet && !deletingThisSet}
                        onSubmitEditing={() => saveSetName(set)}
                      />

                      <View style={styles.actionRow}>
                        <Pressable
                          style={[
                            styles.smallButton,
                            (savingThisSet || deletingThisSet) &&
                              styles.disabledButton,
                          ]}
                          onPress={() => saveSetName(set)}
                          disabled={savingThisSet || deletingThisSet}
                        >
                          <Text style={styles.smallButtonText}>
                            {savingThisSet ? "Saving..." : "Save name"}
                          </Text>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.smallSecondaryButton,
                            (savingThisSet || deletingThisSet) &&
                              styles.disabledButton,
                          ]}
                          onPress={cancelEditingSet}
                          disabled={savingThisSet || deletingThisSet}
                        >
                          <Text style={styles.smallSecondaryButtonText}>
                            Cancel
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}

                  {isExpanded ? (
                    <View style={styles.contentsBox}>
                      <Text style={styles.contentsTitle}>Set contents</Text>

                      {expandedSetWords.length === 0 ? (
                        <View style={styles.emptyMiniState}>
                          <Text style={styles.emptyMiniTitle}>
                            This set is empty
                          </Text>
                          <Text style={styles.emptyMiniText}>
                            Add words from your Library below.
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.wordList}>
                          {expandedSetWords.map((word) => {
                            const aiReady = hasAiContent(word);

                            return (
                              <View key={word.id} style={styles.wordRow}>
                                <Pressable
                                  style={styles.wordInfo}
                                  onPress={() => openWordDetail(word)}
                                >
                                  <Text style={styles.wordText}>
                                    {getDisplayWord(word)}
                                  </Text>
                                  <Text style={styles.wordMeta}>
                                    {word.status ?? "new"} •{" "}
                                    {aiReady ? "Practice ready" : "Needs AI"}
                                  </Text>
                                </Pressable>

                                <Pressable
                                  style={[
                                    styles.removeWordButton,
                                    savingSetItem && styles.disabledButton,
                                  ]}
                                  onPress={() => confirmRemoveWordFromSet(word)}
                                  disabled={savingSetItem}
                                >
                                  <Text style={styles.removeWordButtonText}>
                                    Remove
                                  </Text>
                                </Pressable>
                              </View>
                            );
                          })}
                        </View>
                      )}

                      <View style={styles.addWordsBox}>
                        <Text style={styles.contentsTitle}>Add word to this set</Text>
                        <Text style={styles.emptyMiniText}>
                          Type any word. It will be saved to Library and added to
                          this set automatically.
                        </Text>

                        <TextInput
                          style={styles.input}
                          placeholder="Example: usually"
                          autoCapitalize="none"
                          value={addWordSearch}
                          onChangeText={setAddWordSearch}
                          editable={!savingSetItem}
                          onSubmitEditing={handleAddWordToExpandedSet}
                        />

                        <Pressable
                          style={[
                            styles.button,
                            savingSetItem && styles.disabledButton,
                          ]}
                          onPress={handleAddWordToExpandedSet}
                          disabled={savingSetItem}
                        >
                          <Text style={styles.buttonText}>
                            {savingSetItem ? "Adding..." : "Add to set"}
                          </Text>
                        </Pressable>

                        {addableWords.length > 0 ? (
                          <View style={styles.addableSuggestionBlock}>
                            <Text style={styles.suggestionLabel}>
                              Existing Library matches
                            </Text>

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

function isDue(item: UserWord) {
  if (!item.next_review_at) return true;

  return new Date(item.next_review_at) <= new Date();
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
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
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
    marginBottom: 8,
  },
  helperText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#64748b",
    marginBottom: 14,
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
  disabledButton: {
    opacity: 0.55,
  },
  setList: {
    gap: 12,
  },
  setCard: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 22,
    padding: 16,
  },
  setCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  setTitleWrap: {
    flex: 1,
  },
  setTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 5,
  },
  setMeta: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: "#64748b",
  },
  iconActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e0f2fe",
  },
  iconButtonText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0369a1",
  },
  deleteIconButton: {
    backgroundColor: "#fee2e2",
  },
  deleteIconButtonText: {
    color: "#991b1b",
    fontSize: 22,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  statPill: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 12,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0f172a",
  },
  statLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "900",
    color: "#64748b",
    textTransform: "uppercase",
  },
  detailsToggle: {
    backgroundColor: "#e0f2fe",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  detailsToggleText: {
    color: "#0369a1",
    fontSize: 14,
    fontWeight: "900",
  },
  editBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  smallButton: {
    flex: 1,
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  smallButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  smallSecondaryButton: {
    flex: 1,
    backgroundColor: "#e0f2fe",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  smallSecondaryButtonText: {
    color: "#0369a1",
    fontSize: 14,
    fontWeight: "900",
  },
  contentsBox: {
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  contentsTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 10,
  },
  emptyMiniState: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  emptyMiniTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 4,
  },
  emptyMiniText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748b",
    marginBottom: 10,
  },
  wordList: {
    gap: 8,
    marginBottom: 14,
  },
  wordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  wordInfo: {
    flex: 1,
  },
  wordText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 3,
  },
  wordMeta: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748b",
  },
  removeWordButton: {
    backgroundColor: "#fef2f2",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  removeWordButtonText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#991b1b",
  },
  addWordsBox: {
    marginTop: 4,
  },
  addableSuggestionBlock: {
    marginTop: 14,
  },
  suggestionLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  addableList: {
    gap: 8,
  },
  addableWordRow: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  addableWordText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0369a1",
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
