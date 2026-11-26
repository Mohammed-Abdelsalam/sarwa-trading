import { Tabs } from 'expo-router';
import { ChartLine, Star } from 'lucide-react-native';

import { useColors } from '../../lib/theme';

export default function TabsLayout() {
  const colors = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors['brand-fg'],
        tabBarInactiveTintColor: colors['fg-3'],
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Markets',
          tabBarIcon: ({ color }) => <ChartLine size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'Watchlist',
          tabBarIcon: ({ color, focused }) => (
            <Star size={24} color={color} fill={focused ? color : 'transparent'} />
          ),
        }}
      />
    </Tabs>
  );
}
