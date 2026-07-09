import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import Constants from "expo-constants";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "../../lib/supabase";
import { appAlert } from "../../lib/app-alert";
import { theme } from "../../theme";

type ProfileWordRow = {
  created_at: string;
  last_reviewed_at: string | null;
  ai_content_disabled: boolean | null;
  word_contents:
    | {
        turkish_meaning: string | null;
        simple_definition: string | null;
        mini_lesson: string | null;
      }
    | {
        turkish_meaning: string | null;
        simple_definition: string | null;
        mini_lesson: string | null;
      }[]
    | null;
};

function toDateKey(isoDate: string) {
  return new Date(isoDate).toDateString();
}

function computeStreakDays(activityDateKeys: Set<string>) {
  if (activityDateKeys.size === 0) return 0;

  const today = new Date();
  const hasToday = activityDateKeys.has(today.toDateString());

  // If nothing happened today yet, a streak can still be "alive" through
  // yesterday — start counting from yesterday instead of breaking to 0.
  const cursor = new Date(today);
  if (!hasToday) {
    cursor.setDate(cursor.getDate() - 1);
    if (!activityDateKeys.has(cursor.toDateString())) return 0;
  }

  let streak = 0;
  while (activityDateKeys.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export default function ProfileScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dailyReminder, setDailyReminder] = useState(false);
  const [soundEffects, setSoundEffects] = useState(false);

  const [statsLoading, setStatsLoading] = useState(true);
  const [totalWords, setTotalWords] = useState(0);
  const [aiReadyPercent, setAiReadyPercent] = useState(0);
  const [streakDays, setStreakDays] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthChecked(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authChecked && !session) {
      router.replace("/");
    }
  }, [authChecked, session]);

  const loadStats = useCallback(async () => {
    if (!session) return;

    setStatsLoading(true);

    const { data, error } = await supabase
      .from("user_words")
      .select(
        "created_at, last_reviewed_at, ai_content_disabled, word_contents ( turkish_meaning, simple_definition, mini_lesson )"
      );

    setStatsLoading(false);

    if (error || !data) {
      return;
    }

    const rows = data as ProfileWordRow[];

    setTotalWords(rows.length);

    const aiReadyCount = rows.filter((row) => {
      if (row.ai_content_disabled) return false;

      const content = Array.isArray(row.word_contents)
        ? row.word_contents[0]
        : row.word_contents;

      return Boolean(
        content?.turkish_meaning ||
          content?.simple_definition ||
          content?.mini_lesson
      );
    }).length;

    setAiReadyPercent(
      rows.length > 0 ? Math.round((aiReadyCount / rows.length) * 100) : 0
    );

    const activityDateKeys = new Set<string>();

    rows.forEach((row) => {
      activityDateKeys.add(toDateKey(row.created_at));

      if (row.last_reviewed_at) {
        activityDateKeys.add(toDateKey(row.last_reviewed_at));
      }
    });

    setStreakDays(computeStreakDays(activityDateKeys));
  }, [session]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      appAlert("Çıkış yapılamadı", error.message);
    }
  }

  function handleChangePassword() {
    appAlert(
      "Şifre değiştirme",
      "Bu akışı bir sonraki auth paketinde Supabase ile bağlayacağız."
    );
  }

  function handleLanguageComingSoon(language: "tr" | "en") {
    appAlert(
      "Dil tercihi",
      language === "tr"
        ? "Türkçe şu an aktif dil."
        : "İngilizce dil seçeneği henüz bağlı değil, yakında eklenecek."
    );
  }

  function handleSettingComingSoon() {
    appAlert(
      "Yakında",
      "Bu ayar henüz bir bildirim/ses sistemine bağlı değil. Aktif olduğunda burada değiştirebileceksin."
    );
  }

  if (!session) {
    return <View style={styles.centeredContainer} />;
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

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {statsLoading ? "–" : streakDays}
            </Text>
            <Text style={styles.statLabel}>🔥 Seri</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {statsLoading ? "–" : totalWords}
            </Text>
            <Text style={styles.statLabel}>📚 Kelime</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {statsLoading ? "–" : `${aiReadyPercent}%`}
            </Text>
            <Text style={styles.statLabel}>🎯 AI Hazır</Text>
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
            <Text style={styles.comingSoonTag}>Yakında</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Bildirimler</Text>
        <Text style={styles.cardNote}>
          Bu ayarlar henüz bir bildirim/ses sistemine bağlı değil, yakında
          aktif olacak.
        </Text>

        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingTitle}>Günlük hatırlatıcı</Text>
            <Text style={styles.settingSubtitle}>Yakında · Her gün saat 20:00</Text>
          </View>

          <ToggleSwitch
            value={dailyReminder}
            onValueChange={() => handleSettingComingSoon()}
            disabled
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingTitle}>Ses efektleri</Text>
            <Text style={styles.settingSubtitle}>Yakında · Doğru / yanlış sesleri</Text>
          </View>

          <ToggleSwitch
            value={soundEffects}
            onValueChange={() => handleSettingComingSoon()}
            disabled
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
      <Text style={styles.footerVersion}>
        Sürüm {Constants.expoConfig?.version ?? "1.0.0"}
      </Text>
    </ScrollView>
  );
}


function ToggleSwitch({
  value,
  onValueChange,
  disabled = false,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.toggleTrack,
        value && styles.toggleTrackActive,
        disabled && styles.toggleTrackDisabled,
      ]}
      onPress={() => onValueChange(!value)}
    >
      <View style={[styles.toggleThumb, value && styles.toggleThumbActive]} />
    </Pressable>
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
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing["2xl"],
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
  cardNote: {
    color: theme.colors.textSubtle,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 14,
    marginTop: -6,
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
  comingSoonTag: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "900",
    color: theme.colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.4,
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
  toggleTrack: {
    width: 52,
    height: 30,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceSoft,
    padding: 3,
    justifyContent: "center",
  },
  toggleTrackActive: {
    backgroundColor: theme.colors.primarySoft,
  },
  toggleTrackDisabled: {
    opacity: 0.6,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.textSubtle,
  },
  toggleThumbActive: {
    backgroundColor: theme.colors.primary,
    transform: [{ translateX: 22 }],
  },
  footerText: {
    color: theme.colors.textSubtle,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },
  footerVersion: {
    color: theme.colors.textSubtle,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 4,
  },
});
