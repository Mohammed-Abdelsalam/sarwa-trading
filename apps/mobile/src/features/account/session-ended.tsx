import { LogOut, Mail, OctagonAlert } from 'lucide-react-native';
import { View } from 'react-native';

import { type SessionRevokedReason } from '@sarwa/contracts';

import { BigState, FormScreen, StateArt } from '../../components/layout/form-screen';
import { Button } from '../../components/ui/button';
import { Sheet } from '../../components/ui/sheet';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
import { useColors } from '../../lib/theme';

export interface SuspendedView {
  // Present when the 403 or session.revoked carried the suspension; date already formatted.
  reason?: { category: string; text: string; date: string };
  handle?: string;
  supportEmail: string;
  onContactSupport: () => void;
  onBrowseAsGuest: () => void;
}

export function SuspendedScreen({ view }: { view: SuspendedView }) {
  const { t } = useCopy();
  const colors = useColors();
  return (
    <FormScreen
      footer={
        <>
          <Button
            size="lg"
            icon={<Mail size={16} color={colors['on-brand']} />}
            accessibilityLabel={`${t.support.contactLabel}, ${view.supportEmail}`}
            onPress={view.onContactSupport}
          >
            {t.suspended.contact}
          </Button>
          <Button size="lg" variant="secondary" onPress={view.onBrowseAsGuest}>
            {t.suspended.browseGuest}
          </Button>
          {view.handle ? (
            <Text variant="caption" className="text-center text-fg-3">
              {t.suspended.reference({ handle: view.handle })}
            </Text>
          ) : null}
        </>
      }
    >
      <BigState
        level="h1"
        icon={OctagonAlert}
        tone="neg"
        title={t.suspended.title}
        body={t.suspended.bodyMobile}
      >
        {view.reason ? (
          <View accessible className="w-full gap-1 rounded-lg border border-border bg-surface p-4">
            <Text variant="sm" weight={700}>
              {t.suspended.reasonLabel}
            </Text>
            <Text variant="sm" weight={600}>
              {view.reason.category}
            </Text>
            <Text variant="sm" className="text-fg-2">
              {t.suspended.reason({ reason: view.reason.text, date: view.reason.date })}
            </Text>
          </View>
        ) : null}
      </BigState>
    </FormScreen>
  );
}

// The root "You were signed out" sheet after session.revoked; suspension routes to SuspendedScreen.
export interface SignedOutView {
  reason: Exclude<SessionRevokedReason, 'suspended'> | 'expired' | null;
  onSignIn: () => void;
  onResetPassword: () => void;
  onClose: () => void;
}

export function SignedOutSheet({ view }: { view: SignedOutView }) {
  const { t } = useCopy();
  const { reason } = view;
  return (
    <Sheet visible={reason !== null} onClose={view.onClose}>
      {reason ? (
        <>
          <StateArt icon={LogOut} />
          <View className="gap-1">
            <Text variant="h2" accessibilityRole="header">
              {t.revoked.title}
            </Text>
            <Text variant="sm" className="text-fg-2">
              {t.revoked.reasons[reason]}
            </Text>
          </View>
          <Button size="lg" onPress={view.onSignIn}>
            {t.revoked.signInAgain}
          </Button>
          {reason === 'password_changed' ? (
            <Button size="lg" variant="secondary" onPress={view.onResetPassword}>
              {t.revoked.resetPassword}
            </Button>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}
