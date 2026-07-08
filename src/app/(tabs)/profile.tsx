import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "../../lib/supabase";
import { theme } from "../../theme";

export default function ProfileScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [dailyReminder, setDailyReminder] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
  }, []);

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert("Çıkış yapılamadı", error.message);
    }
  }

  function handleChangePassword() {
    Alert.alert(
      "Şifre değiştirme",
      "Bu akışı bir sonraki auth paketinde Supabase ile bağlayacağız."
    );
  }

  function handleLanguageComingSoon(language: "tr" | "en") {
    Alert.alert(
      "Dil tercihi",
      language === "tr"
        ? "Türkçe şu an aktif dil olarak tasarlanıyor."
        : "English dil seçimini localization paketinde bağlayacağız."
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.screenTitle}>Profilim</Text>

      <View style={styles.heroCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {session?.user?.email?.slice(0, 1).toUpperCase() ?? "K"}
          </Text>
        </View>

        <View style={styles.heroTextBlock}>
          <Text style={styles.name}>Kelimelik AI</Text>
          <Text style={styles.email} numberOfLines={1}>
            {session?.user?.email ?? "Hesabın"}
          </Text>
        </View>

        <View style={styles.proBadge}>
          <Text style={styles.proBadgeText}>PRO</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>23</Text>
            <Text style={styles.statLabel}>🔥 Seri</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text style={styles.statNumber}>1.240</Text>
            <Text style={styles.statLabel}>📚 Kelime</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text style={styles.statNumber}>87%</Text>
            <Text style={styles.statLabel}>🎯 Başarı</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Dil tercihi</Text>

        <View style={styles.languageRow}>
          <Pressable
            style={[styles.languageButton, styles.languageButtonActive]}
            onPress={() => handleLanguageComingSoon("tr")}
          >
            <Text style={styles.languageButtonActiveText}>🇹🇷 Türkçe</Text>
          </Pressable>

          <Pressable
            style={styles.languageButton}
            onPress={() => handleLanguageComingSoon("en")}
          >
            <Text style={styles.languageButtonText}>🇬🇧 English</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Bildirimler</Text>

        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingTitle}>Günlük hatırlatıcı</Text>
            <Text style={styles.settingSubtitle}>Her gün saat 20:00</Text>
          </View>

          <Switch
            value={dailyReminder}
            onValueChange={setDailyReminder}
            trackColor={{
              false: theme.colors.surfaceSoft,
              true: theme.colors.primarySoft,
            }}
            thumbColor={
              dailyReminder ? theme.colors.primary : theme.colors.textSubtle
            }
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingTitle}>Ses efektleri</Text>
            <Text style={styles.settingSubtitle}>Doğru / yanlış sesleri</Text>
          </View>

          <Switch
            value={soundEffects}
            onValueChange={setSoundEffects}
            trackColor={{
              false: theme.colors.surfaceSoft,
              true: theme.colors.primarySoft,
            }}
            thumbColor={
              soundEffects ? theme.colors.primary : theme.colors.textSubtle
            }
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Hesap</Text>

        <Pressable style={styles.accountButton} onPress={handleChangePassword}>
          <Text style={styles.accountButtonText}>Şifreyi değiştir</Text>
          <Text style={styles.accountButtonIcon}>›</Text>
        </Pressable>

        <View style={styles.divider} />

        <Pressable style={styles.accountButton} onPress={handleSignOut}>
          <Text style={styles.dangerText}>Çıkış yap</Text>
          <Text style={styles.accountButtonIcon}>›</Text>
        </Pressable>
      </View>

      <Text style={styles.footerText}>
        Kelimelik AI · Ezberleme. AI ile kullanmayı öğren.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 34,
    backgroundColor: theme.colors.background,
  },
  screenTitle: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 18,
  },
  heroCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    overflow: "hidden",
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: {
    color: theme.colors.textInverse,
    fontSize: 26,
    fontWeight: "900",
  },
  heroTextBlock: {
    marginBottom: 14,
  },
  name: {
    color: theme.colors.textInverse,
    fontSize: 24,
    fontWeight: "900",
  },
  email: {
    color: "#FFE7D8",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 3,
  },
  proBadge: {
    position: "absolute",
    top: 22,
    right: 20,
    backgroundColor: "#FFE7D8",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  proBadgeText: {
    color: theme.colors.primaryDark,
    fontSize: 11,
    fontWeight: "900",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  statItem: {
    flex: 1,
  },
  statNumber: {
    color: theme.colors.textInverse,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 2,
  },
  statLabel: {
    color: "#FFE7D8",
    fontSize: 12,
    fontWeight: "800",
  },
  statDivider: {
    width: 1,
    height: 34,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginHorizontal: 10,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  cardEyebrow: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 14,
  },
  languageRow: {
    flexDirection: "row",
    gap: 10,
  },
  languageButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  languageButtonActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySurface,
  },
  languageButtonText: {
    color: theme.colors.textMuted,
    fontSize: 15,
    fontWeight: "900",
  },
  languageButtonActiveText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: "900",
  },
  settingRow: {
    minHeight: 58,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 3,
  },
  settingSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 8,
  },
  accountButton: {
    minHeight: 52,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accountButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  accountButtonIcon: {
    color: theme.colors.textSubtle,
    fontSize: 24,
    fontWeight: "900",
  },
  dangerText: {
    color: theme.colors.danger,
    fontSize: 16,
    fontWeight: "900",
  },
  footerText: {
    color: theme.colors.textSubtle,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },
});
