import { AlertTriangle, Check, Clock } from 'lucide-react-native';

import { BigState, FormScreen } from '../../components/layout/form-screen';
import { Loading } from '../../components/layout/load-state';
import { TopBar } from '../../components/layout/top-bar';
import { Button } from '../../components/ui/button';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';

export type VerifyEmailView =
  | { state: 'checking' }
  | { state: 'verified'; email: string; onContinue: () => void }
  | {
      state: 'expired';
      // Already formatted with the link's lifetime and, when known, the address.
      body: string;
      resend?: { label: string; disabled: boolean; sentTo?: string; onPress: () => void };
      onClose: () => void;
    }
  | { state: 'failed'; onClose: () => void };

export function VerifyEmailScreen({ view }: { view: VerifyEmailView }) {
  const { t } = useCopy();
  if (view.state === 'checking')
    return (
      <FormScreen>
        <BigState icon={Clock} title={t.auth.verify.checking} />
        <Loading />
      </FormScreen>
    );
  if (view.state === 'verified')
    return (
      <FormScreen
        footer={
          <Button size="lg" onPress={view.onContinue}>
            {t.auth.verify.continue}
          </Button>
        }
      >
        <BigState
          icon={Check}
          tone="pos"
          title={t.auth.verify.okTitle}
          body={t.auth.verify.okBody({ email: view.email })}
        />
      </FormScreen>
    );
  if (view.state === 'failed')
    return (
      <FormScreen header={<TopBar close onLeave={view.onClose} />}>
        <BigState icon={AlertTriangle} tone="neg" title={t.auth.errors.UNKNOWN} />
      </FormScreen>
    );
  const { resend } = view;
  return (
    <FormScreen
      header={<TopBar close onLeave={view.onClose} />}
      footer={
        resend ? (
          <Button size="lg" disabled={resend.disabled} onPress={resend.onPress}>
            {resend.label}
          </Button>
        ) : undefined
      }
    >
      <BigState icon={Clock} tone="warn" title={t.auth.verify.expiredTitle} body={view.body}>
        {resend?.sentTo ? (
          <Text accessibilityLiveRegion="polite" variant="sm" className="text-center text-pos">
            {t.auth.verify.sent({ email: resend.sentTo })}
          </Text>
        ) : null}
      </BigState>
    </FormScreen>
  );
}
