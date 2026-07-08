import { Tabs } from "expo-router";
import { StyleSheet, View, type ColorValue } from "react-native";

import { theme } from "../../theme";

type TabIconName = "home" | "sets" | "words" | "profile";

function TabIcon({
  name,
  color,
  focused,
}: {
  name: TabIconName;
  color: ColorValue;
  focused: boolean;
}) {
  return (
    <View
      style={[
        styles.iconWrap,
        focused && { backgroundColor: theme.colors.primarySurface },
      ]}
    >
      {name === "home" ? <HomeIcon color={color} /> : null}
      {name === "sets" ? <GridIcon color={color} /> : null}
      {name === "words" ? <BookIcon color={color} /> : null}
      {name === "profile" ? <ProfileIcon color={color} /> : null}
    </View>
  );
}

function HomeIcon({ color }: { color: ColorValue }) {
  return (
    <View style={styles.homeIcon}>
      <View style={[styles.homeRoof, { borderBottomColor: color }]} />
      <View style={[styles.homeBody, { borderColor: color }]} />
    </View>
  );
}

function GridIcon({ color }: { color: ColorValue }) {
  return (
    <View style={styles.gridIcon}>
      {[0, 1, 2, 3].map((item) => (
        <View key={item} style={[styles.gridCell, { borderColor: color }]} />
      ))}
    </View>
  );
}

function BookIcon({ color }: { color: ColorValue }) {
  return (
    <View style={[styles.bookIcon, { borderColor: color }]}>
      <View style={[styles.bookLine, { backgroundColor: color }]} />
    </View>
  );
}

function ProfileIcon({ color }: { color: ColorValue }) {
  return (
    <View style={styles.profileIcon}>
      <View style={[styles.profileHead, { borderColor: color }]} />
      <View style={[styles.profileBody, { borderColor: color }]} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSubtle,
        tabBarStyle: {
          height: 82,
          paddingTop: 8,
          paddingBottom: 12,
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "800",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Bugün",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="sets"
        options={{
          title: "Setler",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="sets" color={color} focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="library"
        options={{
          title: "Kelimeler",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="words" color={color} focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="profile" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 34,
    height: 30,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  homeIcon: {
    width: 19,
    height: 18,
    alignItems: "center",
  },
  homeRoof: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  homeBody: {
    width: 14,
    height: 11,
    borderWidth: 1.8,
    borderTopWidth: 0,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  gridIcon: {
    width: 18,
    height: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
  },
  gridCell: {
    width: 7,
    height: 7,
    borderWidth: 1.8,
    borderRadius: 2,
  },
  bookIcon: {
    width: 18,
    height: 18,
    borderWidth: 1.8,
    borderRadius: 4,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  bookLine: {
    width: 1.6,
    height: 12,
    borderRadius: 999,
  },
  profileIcon: {
    width: 18,
    height: 18,
    alignItems: "center",
  },
  profileHead: {
    width: 7,
    height: 7,
    borderWidth: 1.8,
    borderRadius: 999,
    marginBottom: 2,
  },
  profileBody: {
    width: 15,
    height: 8,
    borderWidth: 1.8,
    borderRadius: 999,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
});
