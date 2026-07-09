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
import { Stack, router, useLocalSearchParams } from "expo-router";

import { supabase } from "../../lib/supabase";
import { theme } from "../../theme";

type WordContent = {
  display_word: string | null;
  normalized_word: string | null;
  simple_definition: string | null;
  academic_definition: string | null;
  turkish_meaning: string | null;
  part_of_speech: string | null;
  toefl_example: string | null;
  toefl_example_tr: string | null;
  daily_life_example: string | null;
  daily_life_example_tr: string | null;
  fill_blank_sentence: string | null;
  fill_blank_sentence_tr: string | null;
  fill_blank_answer: string | null;
  meaning_distractors: string[] | null;
  word_distractors: string[] | null;
  synonyms: string[] | null;
  antonyms: string[] | null;
  collocations: string[] | null;
  common_mistake: string | null;
  mnemonic: string | null;
  mini_lesson: string | null;
  cefr_level: string | null;
  difficulty_level: number | null;
};

type UserWordDetail = {
  id: string;
  status: string | null;
  personal_note: string | null;
  created_at: string;
  next_review_at: string | null;
  last_reviewed_at: string | null;
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

const WORD_DETAIL_SELECT = `
  id,
  status,
  personal_note,
  created_at,
  next_review_at,
  last_reviewed_at,
  ai_content_disabled,
  word_contents (
    display_word,
    normalized_word,
    simple_definition,
    academic_definition,
    turkish_meaning,
    part_of_speech,
    toefl_example,
    toefl_example_tr,
    daily_life_example,
    daily_life_example_tr,
    fill_blank_sentence,
    fill_blank_sentence_tr,
    fill_blank_answer,
    meaning_distractors,
    word_distractors,
    synonyms,
    antonyms,
    collocations,
    common_mistake,
    mnemonic,
    mini_lesson,
    cefr_level,
    difficulty_level
  )
`;

export default function WordDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === "string" ? params.id : undefined;

  const [loading, setLoading] = useState(true);
  const [setsLoading, setSetsLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [savingSetChange, setSavingSetChange] = useState(false);

  const [wordDetail, setWordDetail] = useState<UserWordDetail | null>(null);
  const [personalNote, setPersonalNote] = useState("");
  const [sets, setSets] = useState<WordSet[]>([]);
  const [wordSetItems, setWordSetItems] = useState<WordSetItem[]>([]);

  const loadWordDetail = useCallback(async () => {
    if (!id) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("user_words")
      .select(WORD_DETAIL_SELECT)
      .eq("id", id)
      .single();

    setLoading(false);

    if (error) {
      Alert.alert("Kelime yüklenemedi", error.message);
      return;
    }

    const typedData = data as UserWordDetail;

    setWordDetail(typedData);
    setPersonalNote(typedData.personal_note ?? "");
  }, [id]);

  const loadSetsForWord = useCallback(async () => {
    if (!id) return;

    setSetsLoading(true);

    const { data: setsData, error: setsError } = await supabase
      .from("word_sets")
      .select("id, name, description, created_at")
      .order("created_at", { ascending: true });

    if (setsError) {
      setSetsLoading(false);
      Alert.alert("Setler yüklenemedi", setsError.message);
      return;
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from("word_set_items")
      .select("id, set_id, user_word_id")
      .eq("user_word_id", id);

    setSetsLoading(false);

    if (itemsError) {
      Alert.alert("Kelimenin setleri yüklenemedi", itemsError.message);
      return;
    }

    setSets((setsData ?? []) as WordSet[]);
    setWordSetItems((itemsData ?? []) as WordSetItem[]);
  }, [id]);

  useEffect(() => {
    loadWordDetail();
    loadSetsForWord();
  }, [loadWordDetail, loadSetsForWord]);

  const content = getContent(wordDetail);
  const title = content?.display_word ?? content?.normalized_word ?? "Kelime detayı";
  const aiContentDisabled = Boolean(wordDetail?.ai_content_disabled);
  const aiReady = Boolean(
    content && !aiContentDisabled && hasAiContent(content)
  );
  const currentSets = useMemo(
    () => getSetsForThisWord(sets, wordSetItems),
    [sets, wordSetItems]
  );
  const availableSets = useMemo(
    () => getAvailableSetsForThisWord(sets, wordSetItems),
    [sets, wordSetItems]
  );
  const relatedWords = getRelatedWords(content, aiContentDisabled);
  const examples = getExamples(content, aiContentDisabled);

  async function addWordToSet(setId: string) {
    if (!id) return;

    setSavingSetChange(true);

    const { error } = await supabase.from("word_set_items").insert({
      set_id: setId,
      user_word_id: id,
    });

    setSavingSetChange(false);

    if (error && error.code !== "23505") {
      Alert.alert("Sete eklenemedi", error.message);
      return;
    }

    await loadSetsForWord();
  }

  function confirmRemoveFromSet(set: WordSet) {
    Alert.alert(
      "Setten çıkarılsın mı?",
      `"${set.name}" setinden çıkarılacak. Kelime Library içinde kalır.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Çıkar",
          style: "destructive",
          onPress: () => removeWordFromSet(set.id),
        },
      ]
    );
  }

  async function removeWordFromSet(setId: string) {
    if (!id) return;

    setSavingSetChange(true);

    const { error } = await supabase
      .from("word_set_items")
      .delete()
      .eq("set_id", setId)
      .eq("user_word_id", id);

    setSavingSetChange(false);

    if (error) {
      Alert.alert("Setten çıkarılamadı", error.message);
      return;
    }

    await loadSetsForWord();
  }

  async function reenableAiContent() {
    if (!id) return;

    setGeneratingAi(true);

    const { error: enableError } = await supabase
      .from("user_words")
      .update({ ai_content_disabled: false })
      .eq("id", id);

    if (enableError) {
      setGeneratingAi(false);
      Alert.alert("AI açılamadı", enableError.message);
      return;
    }

    // The row update above can briefly lag behind the read the edge function
    // does, so retry a couple of times if it still sees the old disabled flag.
    const maxAttempts = 3;
    let lastError: unknown = null;
    let responseData: { cached?: boolean } | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }

      const { data, error } = await supabase.functions.invoke(
        "generate-word-content",
        {
          body: {
            user_word_id: id,
          },
        }
      );

      if (!error) {
        responseData = data;
        lastError = null;
        break;
      }

      lastError = error;

      const message = await getFunctionErrorMessage(error);

      if (!message.toLowerCase().includes("disabled")) {
        break;
      }
    }

    setGeneratingAi(false);

    if (lastError) {
      const detailedMessage = await getFunctionErrorMessage(lastError);

      Alert.alert("AI içeriği oluşturulamadı", detailedMessage);
      await loadWordDetail();
      return;
    }

    await loadWordDetail();

    if (responseData?.cached) {
      Alert.alert("Zaten hazır", "Bu kelime için AI içeriği daha önce oluşturulmuş.");
      return;
    }

    Alert.alert("AI içeriği açıldı", "Kelime için AI içeriği oluşturuldu.");
  }

  async function generateAiLesson() {
    if (!id || !wordDetail) return;

    if (wordDetail.ai_content_disabled) {
      Alert.alert(
        "AI içeriği kapalı",
        "Bu kelime için AI içeriği kapatıldı. Bu kelimeyi çıkarıp tekrar eklerken AI'yı açabilirsin."
      );
      return;
    }

    setGeneratingAi(true);

    const { data, error } = await supabase.functions.invoke(
      "generate-word-content",
      {
        body: {
          user_word_id: id,
        },
      }
    );

    setGeneratingAi(false);

    if (error) {
      const detailedMessage = await getFunctionErrorMessage(error);

      Alert.alert("AI içeriği oluşturulamadı", detailedMessage);
      return;
    }

    await loadWordDetail();

    if (data?.cached) {
      Alert.alert("Zaten hazır", "Bu kelime için AI içeriği daha önce oluşturulmuş.");
      return;
    }

    Alert.alert("AI içeriği hazır", "Kelime içeriği oluşturuldu.");
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

  async function savePersonalNote() {
    if (!id || !wordDetail) return;

    setSavingNote(true);

    const cleanNote = personalNote.trim();

    const { data, error } = await supabase
      .from("user_words")
      .update({
        personal_note: cleanNote.length > 0 ? cleanNote : null,
      })
      .eq("id", id)
      .select(WORD_DETAIL_SELECT)
      .single();

    setSavingNote(false);

    if (error) {
      Alert.alert("Not kaydedilemedi", error.message);
      return;
    }

    const typedData = data as UserWordDetail;

    setWordDetail(typedData);
    setPersonalNote(typedData.personal_note ?? "");

    Alert.alert("Kaydedildi", "Kişisel notun kaydedildi.");
  }

  function confirmRemoveWord() {
    Alert.alert(
      "Kelime çıkarılsın mı?",
      "Bu işlem kelimeyi Library’den ve bağlı olduğu tüm setlerden çıkarır. AI içeriği veritabanında kalır.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Çıkar",
          style: "destructive",
          onPress: removeWord,
        },
      ]
    );
  }

  async function removeWord() {
    if (!id) return;

    setDeleting(true);

    const { error } = await supabase.from("user_words").delete().eq("id", id);

    setDeleting(false);

    if (error) {
      Alert.alert("Kelime çıkarılamadı", error.message);
      return;
    }

    router.back();
  }

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <Stack.Screen options={{ title: "Yükleniyor..." }} />
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={styles.loadingText}>Kelime yükleniyor...</Text>
      </View>
    );
  }

  if (!wordDetail || !content || !id) {
    return (
      <View style={styles.centeredContainer}>
        <Stack.Screen options={{ title: "Kelime bulunamadı" }} />
        <Text style={styles.emptyTitle}>Kelime bulunamadı</Text>
        <Text style={styles.emptyText}>
          Bu kelime yüklenemedi. Silinmiş olabilir.
        </Text>

        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Geri dön</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: "" }} />

      <View style={styles.topBar}>
        <Pressable style={styles.roundIconButton} onPress={() => router.back()}>
          <Text style={styles.roundIconText}>‹</Text>
        </Pressable>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroDecorOne} />
        <View style={styles.heroDecorTwo} />

        <Text style={styles.partBadge}>
          {getPartLabel(content, aiContentDisabled)}
        </Text>
        <Text style={styles.wordTitle}>{title}</Text>

        <Text style={styles.pronunciationText}>
          {content.normalized_word ? `/${content.normalized_word}/` : "/ kelime /"}
        </Text>

        <View style={styles.meaningBubble}>
          <Text style={styles.primaryMeaning}>
            {getPrimaryMeaning(content, aiContentDisabled)}
          </Text>
          <Text style={styles.simpleMeaning}>
            {getShortDefinition(content, aiContentDisabled)}
          </Text>
        </View>
      </View>

      {aiContentDisabled ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>AI içeriği kapalı</Text>
          <Text style={styles.bodyText}>
            Bu kelimeyi “Yazdığım gibi ekle” ile eklediğin için AI içeriği bu
            kelime için otomatik oluşturulmuyor.
          </Text>

          <Pressable
            style={[styles.primaryButton, generatingAi && styles.disabledButton]}
            onPress={reenableAiContent}
            disabled={generatingAi}
          >
            <Text style={styles.primaryButtonText}>
              {generatingAi ? "Oluşturuluyor..." : "AI'yı bu kelime için aç"}
            </Text>
          </Pressable>
        </View>
      ) : !aiReady ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>AI içeriği gerekli</Text>
          <Text style={styles.bodyText}>
            Bu kelimenin anlam, örnek cümle ve ilgili kelime içeriklerini oluştur.
          </Text>

          <Pressable
            style={[styles.primaryButton, generatingAi && styles.disabledButton]}
            onPress={generateAiLesson}
            disabled={generatingAi}
          >
            <Text style={styles.primaryButtonText}>
              {generatingAi ? "Oluşturuluyor..." : "AI içeriği oluştur"}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.aiIcon}>
                <Text style={styles.aiIconText}>✦</Text>
              </View>
              <Text style={styles.sectionTitle}>AI Örnek Cümleler</Text>
            </View>

            <View style={styles.exampleList}>
              {examples.map((example, index) => (
                <View key={`${example}-${index}`} style={styles.exampleBubble}>
                  <Text style={styles.exampleText}>“{example}”</Text>
                </View>
              ))}
            </View>
          </View>

          {relatedWords.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Bağlantılı Kelimeler</Text>

              <View style={styles.relatedList}>
                {relatedWords.map((word) => (
                  <View key={word} style={styles.relatedChip}>
                    <Text style={styles.relatedChipText}>{word}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {content.common_mistake || content.mnemonic || content.mini_lesson ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Mini Not</Text>

              {content.mini_lesson ? (
                <Text style={styles.bodyText}>{content.mini_lesson}</Text>
              ) : null}

              {content.mnemonic ? (
                <Text style={styles.noteHighlight}>{content.mnemonic}</Text>
              ) : null}

              {content.common_mistake ? (
                <Text style={styles.warningText}>{content.common_mistake}</Text>
              ) : null}
            </View>
          ) : null}
        </>
      )}

      <View style={styles.card}>
        <View style={styles.sectionHeaderBetween}>
          <Text style={styles.sectionTitle}>Setler</Text>

          {setsLoading || savingSetChange ? (
            <Text style={styles.inlineLoadingText}>Güncelleniyor...</Text>
          ) : null}
        </View>

        {currentSets.length === 0 ? (
          <View style={styles.libraryOnlyBox}>
            <Text style={styles.libraryOnlyTitle}>Sadece Library’de</Text>
            <Text style={styles.libraryOnlyText}>
              Bu kelime henüz bir sete eklenmemiş.
            </Text>
          </View>
        ) : (
          <View style={styles.setMembershipList}>
            {currentSets.map((set) => (
              <View key={set.id} style={styles.setMembershipRow}>
                <View style={styles.setMembershipTextWrap}>
                  <Text style={styles.setMembershipTitle}>{set.name}</Text>
                  <Text style={styles.setMembershipMeta}>Bu sette</Text>
                </View>

                <Pressable
                  style={[
                    styles.removeSetButton,
                    savingSetChange && styles.disabledButton,
                  ]}
                  onPress={() => confirmRemoveFromSet(set)}
                  disabled={savingSetChange}
                >
                  <Text style={styles.removeSetButtonText}>Çıkar</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {availableSets.length > 0 ? (
          <View style={styles.addToSetBlock}>
            <Text style={styles.smallSectionTitle}>Başka sete ekle</Text>

            <View style={styles.availableSetList}>
              {availableSets.map((set) => (
                <Pressable
                  key={set.id}
                  style={[
                    styles.addSetChip,
                    savingSetChange && styles.disabledButton,
                  ]}
                  onPress={() => addWordToSet(set.id)}
                  disabled={savingSetChange}
                >
                  <Text style={styles.addSetChipText}>+ {set.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : sets.length === 0 ? (
          <Text style={styles.bodyText}>
            Önce Setler ekranından set oluştur, sonra bu kelimeyi organize edebilirsin.
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Kişisel not</Text>

        <TextInput
          style={styles.noteInput}
          placeholder="Kendi hafıza ipucun, çevirin veya örneğin..."
          placeholderTextColor={theme.colors.textMuted}
          multiline
          value={personalNote}
          onChangeText={setPersonalNote}
          editable={!savingNote}
          textAlignVertical="top"
        />

        <Pressable
          style={[styles.primaryButton, savingNote && styles.disabledButton]}
          onPress={savePersonalNote}
          disabled={savingNote}
        >
          <Text style={styles.primaryButtonText}>
            {savingNote ? "Kaydediliyor..." : "Notu kaydet"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.dangerCard}>
        <Text style={styles.dangerTitle}>Library’den çıkar</Text>
        <Text style={styles.dangerText}>
          Bu işlem kelimeyi Library’den ve bağlı olduğu tüm setlerden çıkarır.
        </Text>

        <Pressable
          style={[styles.dangerButton, deleting && styles.disabledButton]}
          onPress={confirmRemoveWord}
          disabled={deleting}
        >
          <Text style={styles.dangerButtonText}>
            {deleting ? "Çıkarılıyor..." : "Kelimeyi çıkar"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function getContent(wordDetail: UserWordDetail | null) {
  if (!wordDetail) return null;

  return Array.isArray(wordDetail.word_contents)
    ? wordDetail.word_contents[0]
    : wordDetail.word_contents;
}

function hasAiContent(content: WordContent) {
  return Boolean(
    content.simple_definition ||
      content.turkish_meaning ||
      content.daily_life_example ||
      content.toefl_example ||
      content.mini_lesson
  );
}

function getPrimaryMeaning(content: WordContent, aiContentDisabled: boolean) {
  if (aiContentDisabled) {
    return "AI içeriği bu kelime için kapalı.";
  }

  return (
    content.turkish_meaning ||
    content.simple_definition ||
    "Anlam henüz oluşturulmadı."
  );
}

function getShortDefinition(content: WordContent, aiContentDisabled: boolean) {
  if (aiContentDisabled) {
    return "";
  }

  return content.simple_definition || "Basit anlam henüz oluşturulmadı.";
}

function getExamples(content: WordContent | null, aiContentDisabled: boolean) {
  if (aiContentDisabled || !content) {
    return [];
  }

  const examples = [content.daily_life_example, content.toefl_example].filter(
    Boolean
  ) as string[];

  if (examples.length > 0) return examples;

  return ["Örnek cümle henüz oluşturulmadı."];
}

function getRelatedWords(content: WordContent | null, aiContentDisabled: boolean) {
  if (aiContentDisabled || !content) return [];

  return [
    ...(content.synonyms ?? []),
    ...(content.collocations ?? []),
    ...(content.antonyms ?? []),
  ]
    .filter(Boolean)
    .slice(0, 8);
}

function getPartLabel(content: WordContent, aiContentDisabled: boolean) {
  if (aiContentDisabled) {
    return "kelime";
  }

  switch (normalizePartOfSpeech(content.part_of_speech)) {
    case "noun":
      return "isim · noun";
    case "verb":
      return "fiil · verb";
    case "adjective":
      return "sıfat · adjective";
    case "adverb":
      return "zarf · adverb";
    case "phrase":
      return "ifade · phrase";
    case "phrasal verb":
      return "phrasal verb";
    case "preposition":
      return "edat · preposition";
    case "conjunction":
      return "bağlaç · conjunction";
    case "interjection":
      return "ünlem · interjection";
    case "determiner":
      return "belirteç · determiner";
    case "pronoun":
      return "zamir · pronoun";
    default:
      return "kelime";
  }
}

function normalizePartOfSpeech(partOfSpeech: string | null | undefined) {
  return partOfSpeech?.trim().toLowerCase() ?? "";
}

function getSetsForThisWord(sets: WordSet[], wordSetItems: WordSetItem[]) {
  const setIds = new Set(wordSetItems.map((item) => item.set_id));

  return sets.filter((set) => setIds.has(set.id));
}

function getAvailableSetsForThisWord(
  sets: WordSet[],
  wordSetItems: WordSetItem[]
) {
  const setIds = new Set(wordSetItems.map((item) => item.set_id));

  return sets.filter((set) => !setIds.has(set.id));
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  roundIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceSoft,
  },
  roundIconText: {
    marginTop: -2,
    fontSize: 31,
    fontWeight: "500",
    color: theme.colors.text,
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 22,
    marginBottom: 14,
  },
  heroDecorOne: {
    position: "absolute",
    right: -12,
    top: -28,
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  heroDecorTwo: {
    position: "absolute",
    left: -32,
    bottom: -38,
    width: 103,
    height: 103,
    borderRadius: 52,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  partBadge: {
    alignSelf: "flex-start",
    overflow: "hidden",
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: theme.colors.textInverse,
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 22,
  },
  wordTitle: {
    fontSize: 34,
    lineHeight: 39,
    fontWeight: "900",
    color: theme.colors.textInverse,
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  pronunciationText: {
    fontSize: 14,
    fontWeight: "800",
    color: "rgba(255,255,255,0.86)",
    marginBottom: 18,
  },
  meaningBubble: {
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    padding: 15,
  },
  primaryMeaning: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: theme.colors.textInverse,
    marginBottom: 5,
  },
  simpleMeaning: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: "rgba(255,255,255,0.82)",
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 16,
    marginBottom: 14,
    ...theme.shadow.card,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 12,
  },
  sectionHeaderBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  aiIcon: {
    width: 29,
    height: 29,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accent,
  },
  aiIconText: {
    color: theme.colors.textInverse,
    fontSize: 14,
    fontWeight: "900",
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    color: theme.colors.text,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: theme.colors.textMuted,
    marginBottom: 12,
  },
  exampleList: {
    gap: 9,
  },
  exampleBubble: {
    borderRadius: 11,
    backgroundColor: theme.colors.surfaceSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  exampleText: {
    fontSize: 14,
    lineHeight: 21,
    fontStyle: "italic",
    fontWeight: "600",
    color: theme.colors.text,
  },
  relatedList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  relatedChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  relatedChipText: {
    fontSize: 13,
    fontWeight: "900",
    color: theme.colors.text,
  },
  noteHighlight: {
    borderRadius: 12,
    backgroundColor: theme.colors.primarySurface,
    color: theme.colors.primaryDark,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "800",
    padding: 12,
    marginBottom: 10,
  },
  warningText: {
    borderRadius: 12,
    backgroundColor: theme.colors.warningSoft,
    color: theme.colors.warningDark,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "800",
    padding: 12,
  },
  inlineLoadingText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
  },
  libraryOnlyBox: {
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 13,
    marginBottom: 13,
  },
  libraryOnlyTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 4,
  },
  libraryOnlyText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 19,
  },
  setMembershipList: {
    gap: 9,
    marginBottom: 13,
  },
  setMembershipRow: {
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  setMembershipTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  setMembershipTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 4,
  },
  setMembershipMeta: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.textMuted,
  },
  removeSetButton: {
    backgroundColor: theme.colors.dangerSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  removeSetButtonText: {
    color: theme.colors.dangerDark,
    fontSize: 12,
    fontWeight: "900",
  },
  addToSetBlock: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 13,
  },
  smallSectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: theme.colors.textMuted,
    marginBottom: 9,
  },
  availableSetList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  addSetChip: {
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  addSetChipText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  noteInput: {
    minHeight: 105,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 22,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: theme.colors.textInverse,
    fontSize: 15,
    fontWeight: "900",
  },
  dangerCard: {
    backgroundColor: theme.colors.dangerSoft,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#F2B8B0",
  },
  dangerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.dangerDark,
    marginBottom: 7,
  },
  dangerText: {
    fontSize: 14,
    color: theme.colors.dangerDark,
    lineHeight: 21,
    marginBottom: 13,
    fontWeight: "700",
  },
  dangerButton: {
    backgroundColor: theme.colors.danger,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  dangerButtonText: {
    color: theme.colors.textInverse,
    fontSize: 15,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.6,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
});
