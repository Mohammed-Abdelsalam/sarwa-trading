import { ShieldCheck } from 'lucide-react-native';

import { FormScreen } from '../../components/layout/form-screen';
import { TopBar } from '../../components/layout/top-bar';
import { Callout } from '../../components/ui/callout';
import { TextField } from '../../components/ui/text-field';
import { useCopy } from '../../lib/i18n';
import {
  type AuthNotice,
  type FieldModel,
  NoticeCallout,
  SubmitButton,
  type SubmitModel,
} from '../auth/auth-parts';
import { NewPasswordFields, type PasswordPairModel } from '../auth/reset-password-screen';

export interface ChangePasswordView extends PasswordPairModel {
  current: FieldModel;
  notice?: AuthNotice;
  submit: SubmitModel;
  onBack: () => void;
}

export function ChangePasswordScreen({ view }: { view: ChangePasswordView }) {
  const { t } = useCopy();
  return (
    <FormScreen
      header={<TopBar title={t.account.password.change} onLeave={view.onBack} />}
      footer={
        <SubmitButton
          submit={view.submit}
          label={t.account.password.submit}
          loadingLabel={t.account.password.loading}
        />
      }
    >
      {view.notice ? <NoticeCallout notice={view.notice} /> : null}
      <TextField
        label={t.account.password.current}
        autofill="current-password"
        secure
        value={view.current.value}
        onChangeText={view.current.onChange}
        error={view.current.error}
        returnKeyType="next"
      />
      <NewPasswordFields
        pair={view}
        newLabel={t.account.password.new}
        confirmLabel={t.account.password.confirm}
      />
      <Callout tone="info" icon={ShieldCheck} body={t.account.password.warnMobile} />
    </FormScreen>
  );
}
