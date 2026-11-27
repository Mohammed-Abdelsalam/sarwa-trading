import { View } from 'react-native';

import { FormScreen } from '../../components/layout/form-screen';
import { TopBar } from '../../components/layout/top-bar';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
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

export interface ProfileView {
  name: FieldModel;
  email: string;
  emailVerified: boolean;
  handle: string;
  // "Member since Oct 1, 2026"
  memberSince: string;
  // Present while the email is unverified.
  resend?: { label: string; disabled: boolean; onPress: () => void };
  notice?: AuthNotice;
  submit: SubmitModel;
  onBack: () => void;
}

export function ProfileScreen({ view }: { view: ProfileView }) {
  const { t } = useCopy();
  const copy = t.account.profile;
  return (
    <FormScreen
      header={<TopBar title={copy.editTitle} onLeave={view.onBack} />}
      footer={<SubmitButton submit={view.submit} label={copy.save} loadingLabel={copy.save} />}
    >
      {view.notice ? <NoticeCallout notice={view.notice} /> : null}
      <TextField
        label={copy.nameLabel}
        autofill="name"
        value={view.name.value}
        onChangeText={view.name.onChange}
        error={view.name.error}
        returnKeyType="done"
        onSubmitEditing={view.submit.onSubmit}
      />
      <View className="rounded-lg border border-border bg-surface px-4 py-2">
        <KeyValueRow label={copy.email} value={view.email} />
        <View className="flex-row items-center justify-between gap-2 py-1">
          <Badge
            label={view.emailVerified ? copy.verified : copy.unverified}
            tone={view.emailVerified ? 'pos' : 'warn'}
          />
          {view.resend ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={view.resend.disabled}
              onPress={view.resend.onPress}
            >
              {view.resend.label}
            </Button>
          ) : null}
        </View>
        <KeyValueRow label={copy.accountId} value={view.handle} />
      </View>
      <KeyValueRow label={copy.title} value={view.memberSince} />
    </FormScreen>
  );
}
