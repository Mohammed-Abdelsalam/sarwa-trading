'use client';

import { Button, Dialog } from '@sarwa/ui';

import { useCopy } from '../../lib/i18n';
import { type SignedOutView, useSignedOutDialog } from './use-signed-out-dialog';

export function SignedOutDialog({ view }: { view: SignedOutView }) {
  const { t } = useCopy();
  const { reason, actions } = view;
  return (
    <Dialog
      open={reason !== null}
      onOpenChange={(open) => {
        if (!open) actions.dismiss();
      }}
      title={t.revoked.title}
      description={reason ? t.revoked.reasons[reason] : undefined}
      closeLabel={t.common.close}
      footer={
        <>
          {reason === 'password_changed' ? (
            <Button variant="secondary" onClick={actions.resetPassword}>
              {t.revoked.resetPassword}
            </Button>
          ) : null}
          <Button onClick={actions.signIn}>{t.revoked.signInAgain}</Button>
        </>
      }
    />
  );
}

export function SignedOutHost() {
  return <SignedOutDialog view={useSignedOutDialog()} />;
}
