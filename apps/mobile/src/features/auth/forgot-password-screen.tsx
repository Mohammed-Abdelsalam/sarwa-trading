import { Mail } from 'lucide-react-native';

import { BigState, FormScreen, FormTitle } from '../../components/layout/form-screen';
import { TopBar } from '../../components/layout/top-bar';
import { Button } from '../../components/ui/button';
import { Text } from '../../components/ui/text';
import { TextField } from '../../components/ui/text-field';
import { useCopy } from '../../lib/i18n';
import {
  type AuthNotice,
  type FieldModel,
  NoticeCallout,
  SubmitButton,
  type SubmitModel,
} from './auth-parts';

export interface ForgotSentModel {
  email: string;
  // "30 minutes"
  expiresIn: string;
  // "0:54" until another link may be sent.
  resendIn?: string;
  onResend: () => void;
  onOpenMail: () => void;
}

export interface ForgotPasswordView {
  email: FieldModel;
  notice?: AuthNotice;
  submit: SubmitModel;
  sent?: ForgotSentModel;
  onBack: () => void;
}

export function ForgotPasswordScreen({ view }: { view: ForgotPasswordView }) {
  const { t } = useCopy();
  const header = <TopBar onLeave={view.onBack} />;
  const { sent } = view;
  if (sent)
    return (
      <FormScreen
        header={header}
        footer={
          <>
            <Button size="lg" onPress={sent.onOpenMail}>
              {t.auth.forgot.openMail}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              disabled={sent.resendIn !== undefined}
              onPress={sent.onResend}
            >
              {sent.resendIn
                ? t.auth.forgot.resendInShort({ time: sent.resendIn })
                : t.auth.forgot.resend}
            </Button>
          </>
        }
      >
        <BigState
          icon={Mail}
          title={t.auth.forgot.sentTitle}
          body={
            <Text accessibilityLiveRegion="polite" className="text-center text-fg-2">
              {t.auth.forgot.sentBodyMobile({ email: sent.email, duration: sent.expiresIn })}
            </Text>
          }
        />
      </FormScreen>
    );
  return (
    <FormScreen
      header={header}
      footer={
        <>
          <SubmitButton
            submit={view.submit}
            label={t.auth.forgot.submit}
            loadingLabel={t.auth.forgot.sending}
          />
          <Button size="lg" variant="ghost" onPress={view.onBack}>
            {t.auth.backToSignIn}
          </Button>
        </>
      }
    >
      <FormTitle title={t.auth.forgot.title} subtitle={t.auth.forgot.body} />
      {view.notice ? <NoticeCallout notice={view.notice} /> : null}
      <TextField
        label={t.auth.field.email}
        autofill="email"
        placeholder={t.auth.placeholder.email}
        value={view.email.value}
        onChangeText={view.email.onChange}
        error={view.email.error}
        returnKeyType="send"
        onSubmitEditing={view.submit.onSubmit}
      />
    </FormScreen>
  );
}
