import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function LibraryScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Library</Text>
        <Text style={styles.title}>Your word archive</Text>
        <Text style={styles.subtitle}>
          Library will become the clean home for all saved words, search,
          filters, and AI readiness.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Coming next</Text>
        <Text style={styles.cardText}>
          We will move the word list here, then keep Today focused on the next
          best study action.
        </Text>
      </View>
    </ScrollView>
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
    padding: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 8,
  },
  cardText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#475569",
  },
});
