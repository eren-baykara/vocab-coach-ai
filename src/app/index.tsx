import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";

export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsCheckingSession(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function createProfileIfNeeded(userId: string) {
    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: userId,
        exam_goal: "TOEFL",
        english_level: "B2",
        daily_minutes: 10,
        native_language: "Turkish",
      },
      {
        onConflict: "user_id",
      }
    );

    if (error) {
      console.log("Profile create error:", error.message);
    }
  }

  async function handleSignUp() {
    if (!email || !password) {
      Alert.alert("Missing information", "Please enter email and password.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      Alert.alert("Sign up failed", error.message);
      setIsLoading(false);
      return;
    }

    if (data.user) {
      await createProfileIfNeeded(data.user.id);
    }

    setIsLoading(false);
    Alert.alert("Account created", "Welcome to Vocab Coach AI.");
  }

  async function handleSignIn() {
    if (!email || !password) {
      Alert.alert("Missing information", "Please enter email and password.");
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      Alert.alert("Login failed", error.message);
      setIsLoading(false);
      return;
    }

    if (data.user) {
      await createProfileIfNeeded(data.user.id);
    }

    setIsLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (isCheckingSession) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading your session...</Text>
      </View>
    );
  }

  if (session) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Vocab Coach AI</Text>
        <Text style={styles.subtitle}>
          Don&apos;t memorize words. Learn how to use them.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>You are signed in.</Text>
          <Text style={styles.cardText}>{session.user.email}</Text>
        </View>

        <Pressable style={styles.secondaryButton} onPress={handleSignOut}>
          <Text style={styles.secondaryButtonText}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Vocab Coach AI</Text>
      <Text style={styles.subtitle}>
        Don&apos;t memorize words. Learn how to use them.
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          secureTextEntry
          style={styles.input}
        />

        <Pressable
          style={[styles.primaryButton, isLoading && styles.disabledButton]}
          onPress={handleSignUp}
          disabled={isLoading}
        >
          <Text style={styles.primaryButtonText}>
            {isLoading ? "Please wait..." : "Create account"}
          </Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={handleSignIn}
          disabled={isLoading}
        >
          <Text style={styles.secondaryButtonText}>I already have an account</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: 12,
    color: "#6B7280",
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 17,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 32,
    textAlign: "center",
    lineHeight: 24,
  },
  form: {
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    fontSize: 16,
  },
  primaryButton: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  secondaryButtonText: {
    color: "#2563EB",
    fontSize: 16,
    fontWeight: "700",
  },
  card: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  cardText: {
    fontSize: 15,
    color: "#6B7280",
  },
});