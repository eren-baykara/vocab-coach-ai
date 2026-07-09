import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, router } from "expo-router";

import { supabase } from "../lib/supabase";
import { theme } from "../theme";

type ExamGoal = "TOEFL" | "IELTS" | "Genel İngilizce";
type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
type DailyMinutes = 5 | 10 | 15 | 20;

const EXAM_GOALS: { value: ExamGoal; label: string }[] = [
  { value: "TOEFL", label: "TOEFL" },
  { value: "IELTS", label: "IELTS" },
  { value: "Genel İngilizce", label: "Genel İngilizce" },
];

const ENGLISH_LEVELS: { value: EnglishLevel; label: string }[] = [
  { value: "A1", label: "A1 · Başlangıç" },
  { value: "A2", label: "A2 · Temel" },
  { value: "B1", label: "B1 · Orta" },
  { value: "B2", label: "B2 · Orta-üstü" },
  { value: "C1", label: "C1 · İleri" },
  { value: "C2", label: "C2 · Uzman" },
];

const DAILY_MINUTES: DailyMinutes[] = [5, 10, 15, 20];

const DEFAULTS = {
  examGoal: "TOEFL" as ExamGoal,
  englishLevel: "B2" as EnglishLevel,
  dailyMinutes: 10 as DailyMinutes,
};

const TOTAL_STEPS = 3;

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [examGoal, setExamGoal] = useState<ExamGoal>(DEFAULTS.examGoal);
  const [englishLevel, setEnglishLevel] = useState<EnglishLevel>(
    DEFAULTS.englishLevel
  );
  const [dailyMinutes, setDailyMinutes] = useState<DailyMinutes>(
    DEFAULTS.dailyMinutes
  );

  async function finish(values: {
    examGoal: ExamGoal;
    englishLevel: EnglishLevel;
    dailyMinutes: DailyMinutes;
  }) {
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase.from("profiles").upsert(
        {
          user_id: user.id,
          exam_goal: values.examGoal,
          english_level: values.englishLevel,
          daily_minutes: values.dailyMinutes,
        },
        { onConflict: "user_id" }
      );
    }

    setSaving(false);
    router.replace("/(tabs)");
  }

  function goToNextStep() {
    if (step < TOTAL_STEPS - 1) {
      setStep((value) => value + 1);
      return;
    }

    finish({ examGoal, englishLevel, dailyMinutes });
  }

  function skipAll() {
    finish(DEFAULTS);
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${((step + 1) / TOTAL_STEPS) * 100}%` },
            ]}
          />
        </View>

        <Pressable
          onPress={skipAll}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={styles.skipText}>Atla</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {step === 0 ? (
          <StepBlock
            eyebrow={`Adım 1 / ${TOTAL_STEPS}`}
            title="Hangi sınava hazırlanıyorsun?"
            subtitle="İçerikleri buna göre önceliklendirelim."
          >
            <View style={styles.optionList}>
              {EXAM_GOALS.map((option) => (
                <ChoiceChip
                  key={option.value}
                  label={option.label}
                  selected={examGoal === option.value}
                  onPress={() => setExamGoal(option.value)}
                />
              ))}
            </View>
          </StepBlock>
        ) : null}

        {step === 1 ? (
          <StepBlock
            eyebrow={`Adım 2 / ${TOTAL_STEPS}`}
            title="İngilizce seviyen nedir?"
            subtitle="Emin değilsen kabaca bir tahmin yeterli."
          >
            <View style={styles.optionGrid}>
              {ENGLISH_LEVELS.map((option) => (
                <ChoiceChip
                  key={option.value}
                  label={option.label}
                  selected={englishLevel === option.value}
                  onPress={() => setEnglishLevel(option.value)}
                  compact
                />
              ))}
            </View>
          </StepBlock>
        ) : null}

        {step === 2 ? (
          <StepBlock
            eyebrow={`Adım 3 / ${TOTAL_STEPS}`}
            title="Günde ne kadar zaman ayırmak istersin?"
            subtitle="İstediğin zaman değiştirebilirsin."
          >
            <View style={styles.optionList}>
              {DAILY_MINUTES.map((minutes) => (
                <ChoiceChip
                  key={minutes}
                  label={`${minutes} dakika`}
                  selected={dailyMinutes === minutes}
                  onPress={() => setDailyMinutes(minutes)}
                />
              ))}
            </View>
          </StepBlock>
        ) : null}
      </View>

      <Pressable
        style={[styles.primaryButton, saving && styles.disabledButton]}
        onPress={goToNextStep}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={theme.colors.textInverse} />
        ) : (
          <Text style={styles.primaryButtonText}>
            {step < TOTAL_STEPS - 1 ? "Devam et" : "Başla"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function StepBlock({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {children}
    </View>
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
  compact,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.chip,
        compact && styles.chipCompact,
        selected && styles.chipSelected,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 26,
    paddingTop: 60,
    paddingBottom: 30,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 40,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceSoft,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
  },
  skipText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: "800",
  },
  content: {
    flex: 1,
  },
  eyebrow: {
    ...theme.typography.eyebrow,
    color: theme.colors.primary,
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    color: theme.colors.textMuted,
    marginBottom: 30,
  },
  optionList: {
    gap: 12,
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  chipCompact: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  chipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySurface,
  },
  chipText: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.text,
  },
  chipTextSelected: {
    color: theme.colors.primaryDark,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.card,
  },
  primaryButtonText: {
    color: theme.colors.textInverse,
    fontSize: 16,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.7,
  },
});
