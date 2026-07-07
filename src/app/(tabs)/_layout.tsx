import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";

function TabIcon({ icon, color }: { icon: string; color: ColorValue }) {
  return (
    <Text style={{ color, fontSize: 20, fontWeight: "900" }}>
      {icon}
    </Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#94a3b8",
        tabBarStyle: {
          height: 78,
          paddingTop: 8,
          paddingBottom: 12,
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: "#e2e8f0",
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "800",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color }) => <TabIcon icon="●" color={color} />,
        }}
      />

      <Tabs.Screen
        name="sets"
        options={{
          title: "Sets",
          tabBarIcon: ({ color }) => <TabIcon icon="◆" color={color} />,
        }}
      />

      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          tabBarIcon: ({ color }) => <TabIcon icon="■" color={color} />,
        }}
      />
    </Tabs>
  );
}
