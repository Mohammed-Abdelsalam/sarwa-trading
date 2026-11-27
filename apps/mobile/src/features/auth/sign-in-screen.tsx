import { AlertTriangle } from 'lucide-react-native';
import { View } from 'react-native';

import { FormScreen, FormTitle, StateArt } from '../../components/layout/form-screen';
import { TopBar } from '../../components/layout/top-bar';
import { Button } from '../../components/ui/button';
import { Callout } from '../../components/ui/callout';
import { Sheet } from '../../components/ui/sheet';
import { Text } from '../../components/ui/text';
import { TextField } from '../../components/ui/text-field';
import { useCopy } from '../../lib/i18n';
import {
  type AuthNotice,
  FaceIdRow,
  type FieldModel,
  NoticeCallout,
  OAuthButtons,
  SubmitButton,
  type SubmitModel,
  TextLink,
} from './auth-parts';

// The 409 GUEST_DATA_PRESENT step: counts are already formatted ("3 positions").
export interface GuestDataModel {
  positions: string;
  orders: string;
  watchlist: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
}

export interface SignInView {
  email: FieldModel;
  password: FieldModel;
  notice?: AuthNotice;
  submit: SubmitModel;
  guestData?: GuestDataModel;
  onForgot: () => void;
  onSignUp: () => void;
  onClose: () => void;
}

export function GuestDataSheet({ guestData }: { guestData?: GuestDataModel }) {
  const { t } = useCopy();
  return (
    <Sheet visible={guestData !== undefined} onClose={guestData?.onCancel ?? (() => undefined)}>
      {guestData ? (
        <>
          <StateArt icon={AlertTriangle} tone="warn" />
          <View className="gap-1">
            <Text variant="h2" accessibilityRole="header">
              {t.discard.titleMobile}
            </Text>
            <Text variant="sm" className="text-fg-2">
              {t.discard.subMobile}
            </Text>
          </View>
          <Callout
            tone="warn"
            icon={AlertTriangle}
            body={t.discard.bodyMobile({
              positions: guestData.positions,
              orders: guestData.orders,
              watchlist: guestData.watchlist,
            })}
          />
          <Button
            size="lg"
            loading={guestData.confirming}
            disabled={guestData.confirming}
            onPress={guestData.onConfirm}
          >
            {t.discard.confirm}
          </Button>
          <Button size="lg" variant="secondary" onPress={guestData.onCancel}>
            {t.discard.cancel}
          </Button>
        </>
      ) : null}
    </Sheet>
  );
}

export function SignInScreen({ view }: { view: SignInView }) {
  const { t } = useCopy();
  return (
    <FormScreen
      header={
        <TopBar
          close
          onLeave={view.onClose}
          right={<TextLink label={t.auth.signIn.signUpLink} onPress={view.onSignUp} />}
        />
      }
      footer={
        <>
          <SubmitButton
            submit={view.submit}
            label={t.auth.signIn.submit}
            loadingLabel={t.auth.signIn.loading}
          />
          <OAuthButtons />
        </>
      }
    >
      <FormTitle title={t.auth.signIn.title} subtitle={t.auth.signIn.subtitleMobile} />
      {view.notice ? <NoticeCallout notice={view.notice} /> : null}
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
        autofill="current-password"
        secure
        value={view.password.value}
        onChangeText={view.password.onChange}
        error={view.password.error}
        accessory={<TextLink label={t.auth.signIn.forgotShort} onPress={view.onForgot} />}
        returnKeyType="go"
        onSubmitEditing={view.submit.retryIn ? undefined : view.submit.onSubmit}
      />
      <FaceIdRow />
      <GuestDataSheet guestData={view.guestData} />
    </FormScreen>
  );
}
