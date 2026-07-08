export const theme = {
  colors: {
    background: "#F7F3EC",
    surface: "#FFFCF7",
    surfaceSoft: "#F1EADF",
    surfaceMuted: "#FBF7F0",

    border: "#E7DED2",
    borderStrong: "#D8CABB",

    text: "#1F1A17",
    textMuted: "#7B6D62",
    textSubtle: "#A8988A",
    textInverse: "#FFFFFF",

    primary: "#BC5A2A",
    primaryDark: "#9F4520",
    primarySoft: "#F4D7C5",
    primarySurface: "#FFF0E7",

    accent: "#6B5AE6",
    accentSoft: "#ECE9FF",

    success: "#2E9E68",
    successDark: "#237A50",
    successSoft: "#DDF4E9",

    warning: "#C97920",
    warningDark: "#A85F16",
    warningSoft: "#FFF1D8",

    danger: "#D44D3C",
    dangerDark: "#A9372A",
    dangerSoft: "#FFE3DE",
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
    "3xl": 34,
    pill: 999,
  },

  typography: {
    screenTitle: {
      fontSize: 30,
      fontWeight: "900" as const,
      lineHeight: 36,
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
      shadowColor: "#3D2A20",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 3,
    },
  },
} as const;
