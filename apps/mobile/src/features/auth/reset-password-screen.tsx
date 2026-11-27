import { Check, Clock, ShieldCheck } from 'lucide-react-native';

import { BigState, FormScreen } from '../../components/layout/form-screen';
import { Loading } from '../../components/layout/load-state';
import { TopBar } from '../../components/layout/top-bar';
import { Button } from '../../components/ui/button';
import { Callout } from '../../components/ui/callout';
import { Text } from '../../components/ui/text';
import { TextField } from '../../components/ui/text-field';
import { useCopy } from '../../lib/i18n';
import {
  type AuthNotice,
  type FieldModel,
  NoticeCallout,
  StrengthMeter,
  type StrengthModel,
  SubmitButton,
  type SubmitModel,
} from './auth-parts';

export interface PasswordPairModel {
  password: FieldModel;
  confirm: FieldModel;
  strength: StrengthModel;
  matches: boolean;
}

export type ResetPasswordView =
  | ({
      state: 'form';
      // The account the link belongs to, once GET /auth/reset/:token answers.
      email?: string;
      notice?: AuthNotice;
      submit: SubmitModel;
      onClose: () => void;
    } & PasswordPairModel)
  | { state: 'checking'; onClose: () => void }
  | { state: 'done'; onContinue: () => void }
  | {
      state: 'expired';
      // "30 minutes"
      duration: string;
      onRequestNew: () => void;
      onClose: () => void;
    };

// New password + confirm with the strength meter; shared with Change password.
export function NewPasswordFields({
  pair,
  newLabel,
  confirmLabel,
}: {
  pair: PasswordPairModel;
  newLabel: string;
  confirmLabel: string;
}) {
  const { t } = useCopy();
  return (
    <>
      <TextField
        label={newLabel}
        autofill="new-password"
        secure
        value={pair.password.value}
        onChangeText={pair.password.onChange}
        error={pair.password.error}
        returnKeyType="next"
      />
      <StrengthMeter strength={pair.strength} />
      <TextField
        label={confirmLabel}
        autofill="new-password"
        secure
        value={pair.confirm.value}
        onChangeText={pair.confirm.onChange}
        error={pair.confirm.error}
        hint={pair.matches ? t.auth.reset.match : undefined}
      />
    </>
  );
}

export function ResetPasswordScreen({ view }: { view: ResetPasswordView }) {
  const { t } = useCopy();
  if (view.state === 'done')
    return (
      <FormScreen
        footer={
          <Button size="lg" onPress={view.onContinue}>
            {t.auth.reset.continueHome}
          </Button>
        }
      >
        <BigState
          icon={Check}
          tone="pos"
          title={t.auth.reset.doneTitle}
          body={t.auth.reset.doneBodyMobile}
        >
          <Text variant="caption" className="text-center text-fg-3">
            {t.auth.reset.notice}
          </Text>
        </BigState>
      </FormScreen>
    );
  if (view.state === 'expired')
    return (
      <FormScreen
        header={<TopBar close onLeave={view.onClose} />}
        footer={
          <Button size="lg" onPress={view.onRequestNew}>
            {t.auth.reset.requestNew}
          </Button>
        }
      >
        <BigState
          icon={Clock}
          tone="warn"
          title={t.auth.reset.expiredTitle}
          body={t.auth.reset.expiredBody({ duration: view.duration })}
        />
      </FormScreen>
    );
  if (view.state === 'checking')
    return (
      <FormScreen header={<TopBar close onLeave={view.onClose} />}>
        <Loading />
      </FormScreen>
    );
  return (
    <FormScreen
      header={<TopBar close title={t.auth.reset.new} onLeave={view.onClose} />}
      footer={
        <SubmitButton
          submit={view.submit}
          label={t.auth.reset.submit}
          loadingLabel={t.auth.reset.loading}
        />
      }
    >
      {view.email ? (
        <Text variant="sm" className="pt-2 text-fg-2">
          {t.auth.reset.for({ email: view.email })}
        </Text>
      ) : null}
      {view.notice ? <NoticeCallout notice={view.notice} /> : null}
      <NewPasswordFields
        pair={view}
        newLabel={t.auth.reset.new}
        confirmLabel={t.auth.reset.confirmShort}
      />
      <Callout tone="info" icon={ShieldCheck} body={t.auth.reset.warn} />
    </FormScreen>
  );
}
