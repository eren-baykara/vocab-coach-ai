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
import { Stack, router, useLocalSearchParams } from "expo-router";

import { supabase } from "../../lib/supabase";

type WordContent = {
  display_word: string | null;
  normalized_word: string | null;
  simple_definition: string | null;
  academic_definition: string | null;
  turkish_meaning: string | null;
  toefl_example: string | null;
  daily_life_example: string | null;
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
  word_contents: WordContent | WordContent[] | null;
};

export default function WordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [wordDetail, setWordDetail] = useState<UserWordDetail | null>(null);

  const loadWordDetail = useCallback(async () => {
    if (!id) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("user_words")
      .select(
        `
        id,
        status,
        personal_note,
        created_at,
        next_review_at,
        last_reviewed_at,
        word_contents (
          display_word,
          normalized_word,
          simple_definition,
          academic_definition,
          turkish_meaning,
          toefl_example,
          daily_life_example,
          synonyms,
          antonyms,
          collocations,
          common_mistake,
          mnemonic,
          mini_lesson,
          cefr_level,
          difficulty_level
        )
      `
      )
      .eq("id", id)
      .single();

    setLoading(false);

    if (error) {
      Alert.alert("Could not load word", error.message);
      return;
    }

    setWordDetail(data as UserWordDetail);
  }, [id]);

  useEffect(() => {
    loadWordDetail();
  }, [loadWordDetail]);

  function getContent() {
    if (!wordDetail) return null;

    return Array.isArray(wordDetail.word_contents)
      ? wordDetail.word_contents[0]
      : wordDetail.word_contents;
  }

  function renderTextValue(value: string | number | null | undefined) {
    if (value === null || value === undefined || value === "") {
      return "Not generated yet";
    }

    return String(value);
  }

  function renderListValue(value: string[] | null | undefined) {
    if (!value || value.length === 0) {
      return "Not generated yet";
    }

    return value.join(", ");
  }

  const content = getContent();
  const title = content?.display_word ?? "Word detail";

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <Stack.Screen options={{ title: "Loading..." }} />
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading word detail...</Text>
      </View>
    );
  }

  if (!wordDetail || !content) {
    return (
      <View style={styles.centeredContainer}>
        <Stack.Screen options={{ title: "Word not found" }} />
        <Text style={styles.emptyTitle}>Word not found</Text>
        <Text style={styles.emptyText}>
          This word could not be loaded. It may have been removed.
        </Text>

        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title }} />

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>‹ Back</Text>
      </Pressable>

      <View style={styles.heroCard}>
        <Text style={styles.wordTitle}>{content.display_word}</Text>
        <Text style={styles.wordMeta}>
          Status: {wordDetail.status ?? "new"}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Meaning</Text>

        <InfoRow
          label="Simple definition"
          value={renderTextValue(content.simple_definition)}
        />

        <InfoRow
          label="Academic definition"
          value={renderTextValue(content.academic_definition)}
        />

        <InfoRow
          label="Turkish meaning"
          value={renderTextValue(content.turkish_meaning)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Examples</Text>

        <InfoRow
          label="TOEFL / IELTS example"
          value={renderTextValue(content.toefl_example)}
        />

        <InfoRow
          label="Daily life example"
          value={renderTextValue(content.daily_life_example)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Usage</Text>

        <InfoRow label="Synonyms" value={renderListValue(content.synonyms)} />

        <InfoRow label="Antonyms" value={renderListValue(content.antonyms)} />

        <InfoRow
          label="Collocations"
          value={renderListValue(content.collocations)}
        />

        <InfoRow
          label="Common mistake"
          value={renderTextValue(content.common_mistake)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Learning</Text>

        <InfoRow label="Mnemonic" value={renderTextValue(content.mnemonic)} />

        <InfoRow
          label="Mini lesson"
          value={renderTextValue(content.mini_lesson)}
        />

        <InfoRow label="CEFR level" value={renderTextValue(content.cefr_level)} />

        <InfoRow
          label="Difficulty"
          value={renderTextValue(content.difficulty_level)}
        />
      </View>
    </ScrollView>
  );
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
  heroCard: {
    backgroundColor: "#2563eb",
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
  },
  wordTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 8,
  },
  wordMeta: {
    fontSize: 16,
    color: "#dbeafe",
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
  emptyTitle: {
    fontSize: 24,
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
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});