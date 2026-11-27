import { useAdminI18n } from '@sarwa/core/admin';
import { Button, Callout, Dialog } from '@sarwa/ui';

export function ConfirmDialog({
  open,
  title,
  body,
  submit,
  isSaving,
  failed,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  submit: string;
  isSaving: boolean;
  failed: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useAdminI18n();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title={title}
      description={body}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {t.common.cancel}
          </Button>
          <Button variant="danger" loading={isSaving} onClick={onConfirm}>
            {submit}
          </Button>
        </>
      }
    >
      {failed ? (
        <Callout tone="neg" urgent>
          {t.admin.states.actionFailed}
        </Callout>
      ) : null}
    </Dialog>
  );
}
