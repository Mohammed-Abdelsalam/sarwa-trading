import { ChevronRight, Info } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopBar } from '../../components/layout/top-bar';
import { Badge } from '../../components/ui/badge';
import { Segmented } from '../../components/ui/segmented';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
import { useColors } from '../../lib/theme';
import { PlSheet } from '../portfolio/pl-sheet';
import { useAccountScreen } from './use-account-screen';

function SettingsList({ screen }: { screen: ReturnType<typeof useAccountScreen> }) {
  const colors = useColors();
  const { t, dir } = useCopy();
  const { actions } = screen;
  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text variant="sm" weight={600} className="text-fg-2">
          {t.settings.language}
        </Text>
        <Segmented
          full
          label={t.settings.language}
          options={screen.locales}
          value={screen.locale}
          onChange={actions.setLocale}
        />
      </View>
      <View className="gap-2">
        <Text variant="sm" weight={600} className="text-fg-2">
          {t.settings.digits}
        </Text>
        <Segmented
          full
          label={t.settings.digits}
          options={screen.digitStyles}
          value={screen.digits}
          onChange={actions.setDigits}
        />
      </View>
      <View accessible className="min-h-11 flex-row items-center justify-between">
        <Text>{t.settings.theme}</Text>
        <Text className="text-fg-2">{t.settings.themes.system}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={actions.explain}
        className="min-h-11 flex-row items-center gap-2.5 active:opacity-70"
      >
        <Info size={18} color={colors['brand-fg']} />
        <Text className="flex-1">{t.portfolio.howPl}</Text>
        <ChevronRight
          size={16}
          color={colors['fg-3']}
          style={dir === 'rtl' ? { transform: [{ scaleX: -1 }] } : undefined}
        />
      </Pressable>
      <Text variant="caption" className="text-fg-3">
        {screen.disclosure}
      </Text>
      <PlSheet visible={screen.explaining} onClose={actions.closeExplain} />
    </View>
  );
}

export function AccountScreen() {
  const { t } = useCopy();
  const screen = useAccountScreen();
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="px-5 pb-3 pt-1">
        <Text variant="h1" accessibilityRole="header">
          {t.nav.account}
        </Text>
      </View>
      <ScrollView contentContainerClassName="gap-5 px-5 pb-10">
        <View className="gap-2 rounded-lg border border-border bg-surface p-4">
          <View className="flex-row items-center justify-between">
            <Text variant="sm" weight={600} className="text-fg-2">
              {t.paper.account}
            </Text>
            <Badge label={t.paper.badge} tone="outline" />
          </View>
          {screen.account ? (
            <>
              <Text variant="display">{screen.account.equity}</Text>
              <Text variant="caption" className="text-fg-3">
                {`${t.paper.virtualStart} ${screen.account.start} · ${screen.account.handle}`}
              </Text>
            </>
          ) : null}
        </View>
        <Text variant="h3" accessibilityRole="header">
          {t.settings.title}
        </Text>
        <SettingsList screen={screen} />
      </ScrollView>
    </SafeAreaView>
  );
}

export function SettingsScreen() {
  const { t } = useCopy();
  const screen = useAccountScreen();
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <TopBar title={t.settings.title} />
      <ScrollView contentContainerClassName="px-5 pb-10 pt-2">
        <SettingsList screen={screen} />
      </ScrollView>
    </SafeAreaView>
  );
}
