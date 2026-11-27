import { CircleCheck, Eye, Send, Shield } from 'lucide-react';

import { type Role, RoleSchema } from '@sarwa/contracts';
import { useAdminI18n } from '@sarwa/core/admin';
import { Button, Callout, cn, Dialog, Field, Input } from '@sarwa/ui';

export interface InviteDialogView {
  open: boolean;
  email: string;
  role: Role;
  emailInvalid: boolean;
  isSending: boolean;
  failed: boolean;
  validHours: number;
  actions: {
    open: () => void;
    close: () => void;
    setEmail: (email: string) => void;
    setRole: (role: Role) => void;
    submit: () => void;
  };
}

export function InviteDialog({ invite }: { invite: InviteDialogView }) {
  const { t, locale } = useAdminI18n();
  const copy = t.admin.team.inviteDialog;
  const duration = new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'hour',
    unitDisplay: 'long',
  }).format(invite.validHours);
  return (
    <Dialog
      open={invite.open}
      onOpenChange={(open) => {
        if (!open) invite.actions.close();
      }}
      title={copy.title}
      description={copy.body({ duration })}
      className="max-w-125"
      footer={
        <>
          <Button variant="ghost" onClick={invite.actions.close}>
            {t.common.cancel}
          </Button>
          <Button
            type="submit"
            form="invite-form"
            loading={invite.isSending}
            icon={<Send aria-hidden className="size-4" />}
          >
            {invite.isSending ? copy.sending : copy.submit}
          </Button>
        </>
      }
    >
      <form
        id="invite-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          invite.actions.submit();
        }}
      >
        <Field
          label={copy.email}
          error={invite.emailInvalid ? t.admin.users.emailInvalid : undefined}
        >
          {(props) => (
            <Input
              {...props}
              inputSize="lg"
              type="email"
              autoComplete="off"
              value={invite.email}
              onChange={(event) => {
                invite.actions.setEmail(event.target.value);
              }}
            />
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="type-sm text-fg font-semibold">{copy.role}</span>
          <div role="radiogroup" aria-label={copy.role} className="grid grid-cols-2 gap-2.5">
            {RoleSchema.options.map((role) => {
              const checked = invite.role === role;
              return (
                <button
                  key={role}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => {
                    invite.actions.setRole(role);
                  }}
                  className={cn(
                    'border-border bg-surface focus-visible:outline-focus flex cursor-pointer flex-col gap-1 rounded-lg border p-3.5 text-start focus-visible:outline-2',
                    checked && 'border-brand ring-brand-subtle ring-3',
                  )}
                >
                  <span className="text-fg flex items-center gap-2 font-bold">
                    {role === 'ADMIN' ? (
                      <Shield aria-hidden className="size-4" />
                    ) : (
                      <Eye aria-hidden className="size-4" />
                    )}
                    {t.admin.roles[role]}
                    {checked ? (
                      <CircleCheck aria-hidden className="text-brand-fg ms-auto size-4" />
                    ) : null}
                  </span>
                  <span className="type-caption text-fg-3">{t.admin.users.roleShort[role]}</span>
                </button>
              );
            })}
          </div>
        </div>
        {invite.failed ? (
          <Callout tone="neg" urgent>
            {t.admin.states.actionFailed}
          </Callout>
        ) : null}
      </form>
    </Dialog>
  );
}
