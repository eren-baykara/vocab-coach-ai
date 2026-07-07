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
        width: 32,
        height: 28,
        borderRadius: theme.radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? theme.colors.primarySurface : "transparent",
      }}
    >
      <Text
        style={{
          color,
          fontSize: 17,
          fontWeight: "900",
          lineHeight: 20,
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
          height: 80,
          paddingTop: 8,
          paddingBottom: 12,
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "900",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon="●" color={color} focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="sets"
        options={{
          title: "Sets",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon="◆" color={color} focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="library"
        options={{
          title: "Words",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon="■" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
