import { Fingerprint, KeyRound, LogOut, Monitor, Smartphone } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StateArt } from '../../components/layout/form-screen';
import { Loading, LoadError } from '../../components/layout/load-state';
import { TopBar } from '../../components/layout/top-bar';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { SettingsCard, SettingsRow } from '../../components/ui/settings-row';
import { Sheet } from '../../components/ui/sheet';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
import { useColors } from '../../lib/theme';

export interface SessionRowModel {
  id: string;
  label: string;
  platform: 'web' | 'ios' | 'android';
  // "41.32.•.• · 2 min ago"
  meta: string;
  current: boolean;
  signingOut: boolean;
}

export interface SignOutOthersModel {
  // Already formatted: "2 sessions", "Chrome on macOS and Safari on iPadOS", "2 devices".
  sessions: string;
  devices: string;
  deviceCount: string;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface SecurityView {
  // "34 days ago" style, from account.password.lastChanged.
  passwordChanged: string;
  sessions: readonly SessionRowModel[] | null;
  sessionsError: boolean;
  // "3 devices"
  devices: string;
  confirmSignOutOthers?: SignOutOthersModel;
  onChangePassword: () => void;
  onSignOutSession: (id: string) => void;
  onSignOutOthers: () => void;
  onRetry: () => void;
  onBack: () => void;
}

function SessionRow({
  session,
  onSignOut,
}: {
  session: SessionRowModel;
  onSignOut: (id: string) => void;
}) {
  const { t } = useCopy();
  return (
    <SettingsRow
      icon={session.platform === 'web' ? Monitor : Smartphone}
      title={session.label}
      sub={session.current ? t.account.sessions.activeNow : session.meta}
      accessibilityLabel={`${session.label}, ${session.current ? t.account.sessions.thisDevice : session.meta}`}
      trailing={
        session.current ? (
          <Badge label={t.account.sessions.thisDevice} tone="pos" />
        ) : (
          <Button
            size="sm"
            variant="ghost"
            loading={session.signingOut}
            disabled={session.signingOut}
            accessibilityLabel={t.account.sessions.signOutA11y({ device: session.label })}
            onPress={() => {
              onSignOut(session.id);
            }}
          >
            {t.account.sessions.signOut}
          </Button>
        )
      }
    />
  );
}

export function SignOutOthersSheet({ confirm }: { confirm?: SignOutOthersModel }) {
  const { t } = useCopy();
  return (
    <Sheet visible={confirm !== undefined} onClose={confirm?.onCancel ?? (() => undefined)}>
      {confirm ? (
        <>
          <StateArt icon={LogOut} />
          <View className="gap-1">
            <Text variant="h2" accessibilityRole="header">
              {t.account.signOutOthers.title}
            </Text>
            <Text variant="sm" className="text-fg-2">
              {t.account.signOutOthers.sub({ sessions: confirm.sessions })}
            </Text>
          </View>
          <Text variant="sm" className="text-fg-2">
            {t.account.signOutOthers.bodyMobile({ devices: confirm.devices })}
          </Text>
          <Button
            size="lg"
            loading={confirm.confirming}
            disabled={confirm.confirming}
            onPress={confirm.onConfirm}
          >
            {t.account.signOutOthers.confirm({ devices: confirm.deviceCount })}
          </Button>
          <Button size="lg" variant="secondary" onPress={confirm.onCancel}>
            {t.common.cancel}
          </Button>
        </>
      ) : null}
    </Sheet>
  );
}

export function SecurityScreen({ view }: { view: SecurityView }) {
  const { t } = useCopy();
  const colors = useColors();
  const others = view.sessions?.some((session) => !session.current) ?? false;
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <TopBar title={t.account.sections.security} onLeave={view.onBack} />
      <ScrollView contentContainerClassName="gap-4 px-5 pb-10 pt-2">
        <SettingsCard>
          <SettingsRow
            icon={KeyRound}
            title={t.account.password.change}
            value={view.passwordChanged}
            onPress={view.onChangePassword}
          />
          <SettingsRow
            icon={Fingerprint}
            title={t.account.twoFactor.mobileTitle}
            trailing={<Badge label={t.account.twoFactor.soon} />}
          />
        </SettingsCard>
        <Text variant="overline" accessibilityRole="header" className="text-fg-3">
          {t.account.sessions.title}
        </Text>
        {view.sessionsError ? (
          <LoadError title={t.account.sessions.loadError} onRetry={view.onRetry} />
        ) : view.sessions ? (
          <SettingsCard>
            {view.sessions.map((session) => (
              <SessionRow key={session.id} session={session} onSignOut={view.onSignOutSession} />
            ))}
          </SettingsCard>
        ) : (
          <Loading />
        )}
        {others ? (
          <Button
            size="lg"
            variant="secondary"
            icon={<LogOut size={16} color={colors.fg} />}
            onPress={view.onSignOutOthers}
          >
            {t.account.sessions.signOutOthers}
          </Button>
        ) : null}
        <Text variant="caption" className="text-fg-3">
          {t.account.sessions.sub({ devices: view.devices })}
        </Text>
      </ScrollView>
      <SignOutOthersSheet confirm={view.confirmSignOutOthers} />
    </SafeAreaView>
  );
}
