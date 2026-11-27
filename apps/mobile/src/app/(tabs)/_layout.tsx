import { Tabs } from 'expo-router';
import { ChartArea, ChartLine, LayoutGrid, type LucideIcon, Star, User } from 'lucide-react-native';
import { type ColorValue } from 'react-native';

import { componentTypography } from '@sarwa/tokens';

import { fontFile } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
import { useColors } from '../../lib/theme';

// Five tabs need the board's 10 px labels to fit at 320 pt; the tab token is 11 px.
const TAB_LABEL = {
  fontFamily: fontFile('sans', componentTypography.tab.weight),
  fontSize: componentTypography.tab.size - 1,
};

const icon = (Icon: LucideIcon, filled = false) =>
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    const tint = typeof color === 'string' ? color : undefined;
    return <Icon size={24} color={tint} fill={filled && focused ? tint : 'transparent'} />;
  };

export default function TabsLayout() {
  const colors = useColors();
  const { t } = useCopy();
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
      <Tabs.Screen name="index" options={{ title: t.nav.home, tabBarIcon: icon(LayoutGrid) }} />
      <Tabs.Screen name="markets" options={{ title: t.nav.markets, tabBarIcon: icon(ChartLine) }} />
      <Tabs.Screen
        name="portfolio"
        options={{ title: t.nav.portfolio, tabBarIcon: icon(ChartArea) }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{ title: t.nav.watchlist, tabBarIcon: icon(Star, true) }}
      />
      <Tabs.Screen name="account" options={{ title: t.nav.account, tabBarIcon: icon(User) }} />
    </Tabs>
  );
}
