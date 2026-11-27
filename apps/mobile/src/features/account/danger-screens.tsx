import { AlertTriangle, RotateCcw } from 'lucide-react-native';
import { View } from 'react-native';

import { FormScreen } from '../../components/layout/form-screen';
import { TopBar } from '../../components/layout/top-bar';
import { Button } from '../../components/ui/button';
import { Callout } from '../../components/ui/callout';
import { KeyValueRow } from '../../components/ui/key-value-row';
import { TextField } from '../../components/ui/text-field';
import { useCopy } from '../../lib/i18n';
import {
  type AuthNotice,
  type FieldModel,
  NoticeCallout,
  SubmitButton,
  type SubmitModel,
} from '../auth/auth-parts';

// The word to type comes from contracts (DELETE_CONFIRM / RESET_CONFIRM).
interface TypedConfirm extends FieldModel {
  word: string;
}

export interface DeleteAccountView {
  // "7 days"
  grace: string;
  // deleteDialog.body, formatted with the /me/summary counts.
  consequences: string;
  password: FieldModel;
  confirm: TypedConfirm;
  notice?: AuthNotice;
  submit: SubmitModel;
  onCancel: () => void;
}

export interface ResetAccountView {
  // resetDialog.body, formatted with the live counts.
  consequences: string;
  equityNow: string;
  equityAfter: string;
  confirm: TypedConfirm;
  notice?: AuthNotice;
  submit: SubmitModel;
  onCancel: () => void;
}

function TypedConfirmField({ confirm, label }: { confirm: TypedConfirm; label: string }) {
  const { t } = useCopy();
  return (
    <TextField
      label={label}
      autofill="off"
      value={confirm.value}
      onChangeText={confirm.onChange}
      error={confirm.error}
      hint={t.account.deleteDialog.caseSensitive}
    />
  );
}

export function DeleteAccountScreen({ view }: { view: DeleteAccountView }) {
  const { t } = useCopy();
  const copy = t.account.deleteDialog;
  return (
    <FormScreen
      header={<TopBar title={t.account.rows.deleteAccount} onLeave={view.onCancel} />}
      footer={
        <>
          <SubmitButton
            variant="danger"
            submit={view.submit}
            label={copy.confirmMobile}
            loadingLabel={copy.deleting}
          />
          <Button size="lg" variant="ghost" onPress={view.onCancel}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <Callout
        tone="neg"
        icon={AlertTriangle}
        title={copy.subMobile({ days: view.grace })}
        body={view.consequences}
      />
      {view.notice ? <NoticeCallout notice={view.notice} /> : null}
      <TextField
        label={copy.password}
        autofill="current-password"
        secure
        value={view.password.value}
        onChangeText={view.password.onChange}
        error={view.password.error}
        returnKeyType="next"
      />
      <TypedConfirmField confirm={view.confirm} label={copy.type({ word: view.confirm.word })} />
    </FormScreen>
  );
}

export function ResetAccountScreen({ view }: { view: ResetAccountView }) {
  const { t } = useCopy();
  const copy = t.account.resetDialog;
  return (
    <FormScreen
      header={<TopBar title={copy.title} onLeave={view.onCancel} />}
      footer={
        <>
          <SubmitButton
            variant="danger"
            submit={view.submit}
            label={copy.confirm}
            loadingLabel={copy.resetting}
          />
          <Button size="lg" variant="ghost" onPress={view.onCancel}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <Callout tone="warn" icon={RotateCcw} body={view.consequences} />
      <View className="rounded-lg border border-border bg-surface px-4 py-2">
        <KeyValueRow label={copy.equityNow} value={view.equityNow} />
        <KeyValueRow label={copy.afterReset} value={view.equityAfter} total />
      </View>
      {view.notice ? <NoticeCallout notice={view.notice} /> : null}
      <TypedConfirmField confirm={view.confirm} label={copy.type({ word: view.confirm.word })} />
    </FormScreen>
  );
}
