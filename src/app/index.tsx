import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vocab Coach AI</Text>
      <Text style={styles.subtitle}>
        Don&apos;t memorize words. Learn how to use them.
      </Text>
      <Text style={styles.description}>
        Your AI-powered vocabulary coach for TOEFL, IELTS, and GRE.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    alignItems: "center",
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
    fontSize: 18,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 16,
    textAlign: "center",
  },
  description: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
  },
});