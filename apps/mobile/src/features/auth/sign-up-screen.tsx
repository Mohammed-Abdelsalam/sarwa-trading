import { FormScreen, FormTitle } from '../../components/layout/form-screen';
import { TopBar } from '../../components/layout/top-bar';
import { TextField } from '../../components/ui/text-field';
import { useCopy } from '../../lib/i18n';
import {
  Checkbox,
  type AuthNotice,
  type FieldModel,
  NoticeCallout,
  OAuthButtons,
  StrengthMeter,
  type StrengthModel,
  SubmitButton,
  type SubmitModel,
  TermsLabel,
  termsText,
  TextLink,
} from './auth-parts';

export interface SignUpView {
  startingCash: string;
  name: FieldModel;
  email: FieldModel;
  password: FieldModel;
  strength: StrengthModel;
  terms: { checked: boolean; onChange: (checked: boolean) => void; error?: string };
  notice?: AuthNotice;
  submit: SubmitModel;
  onSignIn: () => void;
  onClose: () => void;
}

export function SignUpScreen({ view }: { view: SignUpView }) {
  const copy = useCopy();
  const { t } = copy;
  return (
    <FormScreen
      header={
        <TopBar
          close
          onLeave={view.onClose}
          right={<TextLink label={t.auth.signUp.signInLink} onPress={view.onSignIn} />}
        />
      }
      footer={
        <>
          <SubmitButton
            submit={view.submit}
            label={t.auth.signUp.submit}
            loadingLabel={t.auth.signUp.loading}
          />
          <OAuthButtons />
        </>
      }
    >
      <FormTitle
        title={t.auth.signUp.title}
        subtitle={t.auth.valueLine({ amount: view.startingCash })}
      />
      {view.notice ? <NoticeCallout notice={view.notice} /> : null}
      <TextField
        label={t.auth.field.name}
        autofill="name"
        placeholder={t.auth.placeholder.name}
        value={view.name.value}
        onChangeText={view.name.onChange}
        error={view.name.error}
        returnKeyType="next"
      />
      <TextField
        label={t.auth.field.email}
        autofill="email"
        placeholder={t.auth.placeholder.email}
        value={view.email.value}
        onChangeText={view.email.onChange}
        error={view.email.error}
        returnKeyType="next"
      />
      <TextField
        label={t.auth.field.password}
        autofill="new-password"
        secure
        value={view.password.value}
        onChangeText={view.password.onChange}
        error={view.password.error}
      />
      <StrengthMeter strength={view.strength} />
      <Checkbox
        label={termsText(copy)}
        checked={view.terms.checked}
        onChange={view.terms.onChange}
        error={view.terms.error}
      >
        <TermsLabel />
      </Checkbox>
    </FormScreen>
  );
}
