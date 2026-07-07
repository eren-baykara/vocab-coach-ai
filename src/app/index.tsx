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
import { router } from "expo-router";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";

type WordContent = {
  display_word: string | null;
};

type UserWord = {
  id: string;
  status: string | null;
  created_at: string;
  word_contents: WordContent | WordContent[] | null;
};

export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [authLoading, setAuthLoading] = useState(false);
  const [wordsLoading, setWordsLoading] = useState(false);
  const [addingWord, setAddingWord] = useState(false);

  const [word, setWord] = useState("");
  const [words, setWords] = useState<UserWord[]>([]);

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
        word_contents (
          display_word
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

  useEffect(() => {
    if (session) {
      loadWords();
    } else {
      setWords([]);
    }
  }, [session, loadWords]);

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

  async function handleAddWord() {
    const cleanWord = word.trim();

    if (!cleanWord) {
      Alert.alert("Missing word", "Please enter a word first.");
      return;
    }

    setAddingWord(true);

    const { error } = await supabase.rpc("add_user_word", {
      input_word: cleanWord,
    });

    setAddingWord(false);

    if (error) {
      Alert.alert("Could not add word", error.message);
      return;
    }

    setWord("");
    await loadWords();
  }

  function getDisplayWord(item: UserWord) {
    const content = Array.isArray(item.word_contents)
      ? item.word_contents[0]
      : item.word_contents;

    return content?.display_word ?? "Untitled word";
  }

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
            Don&apos;t memorize words. Learn how to use them.
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
          <Text style={styles.title}>My Words</Text>
          <Text style={styles.subtitle}>{session.user.email}</Text>
        </View>

        <Pressable style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add a new word</Text>

        <TextInput
          style={styles.input}
          placeholder="Example: analyze"
          autoCapitalize="none"
          value={word}
          onChangeText={setWord}
          editable={!addingWord}
        />

        <Pressable
          style={[styles.button, addingWord && styles.disabledButton]}
          onPress={handleAddWord}
          disabled={addingWord}
        >
          <Text style={styles.buttonText}>
            {addingWord ? "Adding..." : "Add word"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.wordsHeader}>
          <Text style={styles.sectionTitle}>Your vocabulary</Text>

          <Pressable onPress={loadWords} disabled={wordsLoading}>
            <Text style={styles.refreshText}>
              {wordsLoading ? "Loading..." : "Refresh"}
            </Text>
          </Pressable>
        </View>

        {wordsLoading && words.length === 0 ? (
          <View style={styles.emptyState}>
            <ActivityIndicator />
            <Text style={styles.emptyStateText}>Loading your words...</Text>
          </View>
        ) : words.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No words yet</Text>
            <Text style={styles.emptyStateText}>
              Add your first word to start building your personal vocabulary list.
            </Text>
          </View>
        ) : (
          <View style={styles.wordList}>
            {words.map((item) => (
              <Pressable
                key={item.id}
                style={styles.wordItem}
                onPress={() => openWordDetail(item)}
              >
                <View>
                  <Text style={styles.wordText}>{getDisplayWord(item)}</Text>
                  <Text style={styles.statusText}>{item.status ?? "new"}</Text>
                </View>

                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
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
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#475569",
  },
  header: {
    marginBottom: 20,
    gap: 16,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
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
    fontWeight: "700",
    color: "#0f172a",
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
    fontWeight: "700",
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
    fontWeight: "700",
  },
  wordsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  refreshText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 28,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700",
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
    padding: 14,
    backgroundColor: "#f8fafc",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  wordText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  statusText: {
    fontSize: 14,
    color: "#64748b",
  },
  chevron: {
    fontSize: 30,
    color: "#94a3b8",
  },
});