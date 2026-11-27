import { cents, useI18n } from '@sarwa/core';
import { Button, Callout, Dialog, Field, Input } from '@sarwa/ui';

import { type AccountsPageModel } from './use-accounts-page';

export function ResetDialog({
  reset,
  startingCashCents,
  onClose,
  onConfirmText,
  onConfirm,
}: {
  reset: AccountsPageModel['reset'];
  startingCashCents: number;
  onClose: () => void;
  onConfirmText: (text: string) => void;
  onConfirm: () => void;
}) {
  const { t, f } = useI18n();
  return (
    <Dialog
      open={reset.account !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.admin.resetAccount}
      description={t.admin.resetBody({ start: f.money(cents(startingCashCents)) })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            variant="danger"
            disabled={!reset.confirmed}
            loading={reset.isSaving}
            onClick={onConfirm}
          >
            {t.admin.resetAccount}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <Field label={t.admin.resetConfirmLabel({ handle: reset.phrase })}>
          {(field) => (
            <Input
              {...field}
              autoComplete="off"
              spellCheck={false}
              className="type-mono"
              placeholder={reset.phrase}
              value={reset.text}
              onChange={(event) => {
                onConfirmText(event.target.value);
              }}
            />
          )}
        </Field>
      </form>
      {reset.failed ? (
        <Callout tone="neg" urgent>
          {t.admin.states.actionFailed}
        </Callout>
      ) : null}
    </Dialog>
  );
}
