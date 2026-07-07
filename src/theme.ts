export const theme = {
  colors: {
    background: "#F8FAFC",
    surface: "#FFFFFF",
    surfaceSoft: "#F1F5F9",
    surfaceMuted: "#F8FAFC",

    border: "#E2E8F0",
    borderStrong: "#CBD5E1",

    text: "#0F172A",
    textMuted: "#64748B",
    textSubtle: "#94A3B8",
    textInverse: "#FFFFFF",

    primary: "#2563EB",
    primaryDark: "#1D4ED8",
    primarySoft: "#DBEAFE",
    primarySurface: "#EFF6FF",

    success: "#16A34A",
    successDark: "#15803D",
    successSoft: "#DCFCE7",

    warning: "#D97706",
    warningDark: "#B45309",
    warningSoft: "#FEF3C7",

    danger: "#DC2626",
    dangerDark: "#B91C1C",
    dangerSoft: "#FEE2E2",
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    "2xl": 24,
    "3xl": 32,
    "4xl": 40,
  },

  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    "2xl": 28,
    pill: 999,
  },

  typography: {
    screenTitle: {
      fontSize: 32,
      fontWeight: "900" as const,
      lineHeight: 38,
    },
    sectionTitle: {
      fontSize: 22,
      fontWeight: "900" as const,
      lineHeight: 28,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: "900" as const,
      lineHeight: 24,
    },
    body: {
      fontSize: 16,
      fontWeight: "400" as const,
      lineHeight: 23,
    },
    bodyStrong: {
      fontSize: 16,
      fontWeight: "800" as const,
      lineHeight: 23,
    },
    caption: {
      fontSize: 13,
      fontWeight: "800" as const,
      lineHeight: 18,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: "900" as const,
      letterSpacing: 0.7,
      textTransform: "uppercase" as const,
    },
  },

  shadow: {
    card: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 18,
      elevation: 3,
    },
  },
} as const;
