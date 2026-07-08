import { Tabs } from "expo-router";
import { Text, View, type ColorValue } from "react-native";

import { theme } from "../../theme";

function TabIcon({
  icon,
  color,
  focused,
}: {
  icon: string;
  color: ColorValue;
  focused: boolean;
}) {
  return (
    <View
      style={{
        width: 34,
        height: 30,
        borderRadius: theme.radius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? theme.colors.primarySurface : "transparent",
      }}
    >
      <Text
        style={{
          color,
          fontSize: 18,
          fontWeight: "900",
          lineHeight: 22,
        }}
      >
        {icon}
      </Text>
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
            <TabIcon icon="⌂" color={color} focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="sets"
        options={{
          title: "Setler",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon="▦" color={color} focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="library"
        options={{
          title: "Kelimeler",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon="▤" color={color} focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon="○" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
