import {
  Bell,
  Globe,
  LogOut,
  RotateCcw,
  Shield,
  Sun,
  Trash2,
  User,
  Zap,
} from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '../../components/ui/badge';
import { SettingsCard, SettingsRow } from '../../components/ui/settings-row';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';

export interface SignedInAccountView {
  name: string;
  email: string;
  emailVerified: boolean;
  // ACC-7F2K9Q
  handle: string;
  // Already formatted: "3 devices", "English", "Dark".
  devices: string;
  language: string;
  theme: string;
  onPersonalInfo: () => void;
  onSecurity: () => void;
  onNotifications: () => void;
  onLanguage: () => void;
  onAppearance: () => void;
  onTrading: () => void;
  onReset: () => void;
  onSignOut: () => void;
  onDelete: () => void;
}

export function SignedInAccountScreen({ view }: { view: SignedInAccountView }) {
  const { t } = useCopy();
  const { rows } = t.account;
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="px-5 pb-3 pt-1">
        <Text variant="h1" accessibilityRole="header">
          {t.nav.account}
        </Text>
      </View>
      <ScrollView contentContainerClassName="gap-4 px-5 pb-10">
        <View
          accessible
          className="flex-row items-center gap-3 rounded-lg border border-border bg-surface p-4"
        >
          <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-subtle">
            <Text variant="h2" className="text-brand-fg">
              {view.name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text weight={700} numberOfLines={1}>
              {view.name}
            </Text>
            <View className="flex-row flex-wrap items-center gap-1.5">
              <Text variant="sm" numberOfLines={1} className="shrink text-fg-2">
                {view.email}
              </Text>
              <Badge
                label={
                  view.emailVerified ? t.account.profile.verified : t.account.profile.unverified
                }
                tone={view.emailVerified ? 'pos' : 'warn'}
              />
            </View>
            <Text variant="caption" className="text-fg-3">
              {view.handle}
            </Text>
          </View>
        </View>
        <SettingsCard>
          <SettingsRow icon={User} title={rows.personalInfo} onPress={view.onPersonalInfo} />
          <SettingsRow
            icon={Shield}
            title={rows.security}
            value={view.devices}
            onPress={view.onSecurity}
          />
          <SettingsRow icon={Bell} title={rows.notifications} onPress={view.onNotifications} />
          <SettingsRow
            icon={Globe}
            title={rows.language}
            value={view.language}
            onPress={view.onLanguage}
          />
          <SettingsRow
            icon={Sun}
            title={rows.appearance}
            value={view.theme}
            onPress={view.onAppearance}
          />
          <SettingsRow
            icon={Zap}
            title={rows.trading}
            value={rows.tradingSub}
            onPress={view.onTrading}
          />
        </SettingsCard>
        <SettingsCard>
          <SettingsRow
            icon={RotateCcw}
            title={t.account.danger.resetTitle}
            onPress={view.onReset}
          />
          <SettingsRow icon={LogOut} title={rows.signOut} onPress={view.onSignOut} />
          <SettingsRow
            icon={Trash2}
            title={rows.deleteAccount}
            danger
            chevron={false}
            onPress={view.onDelete}
          />
        </SettingsCard>
      </ScrollView>
    </SafeAreaView>
  );
}
