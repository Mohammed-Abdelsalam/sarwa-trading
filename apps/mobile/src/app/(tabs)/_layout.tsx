import { Tabs } from 'expo-router';
import { ChartLine, Star } from 'lucide-react-native';

import { componentTypography } from '@sarwa/tokens';

import { fontFile } from '../../components/ui/text';
import { useColors } from '../../lib/theme';

const TAB_LABEL = {
  fontFamily: fontFile('sans', componentTypography.tab.weight),
  fontSize: componentTypography.tab.size,
};

export default function TabsLayout() {
  const colors = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors['brand-fg'],
        tabBarInactiveTintColor: colors['fg-3'],
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: TAB_LABEL,
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
