import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function SetsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Sets</Text>
        <Text style={styles.title}>Organize your words</Text>
        <Text style={styles.subtitle}>
          Sets will become the main place to manage TOEFL, Daily English,
          mistakes, and focused study lists.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Coming next</Text>
        <Text style={styles.cardText}>
          We will move set creation, rename, delete, and set stats here so Today
          can stay focused on studying.
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
