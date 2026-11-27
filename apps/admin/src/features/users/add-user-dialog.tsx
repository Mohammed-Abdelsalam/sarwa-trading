import { CircleCheck, Eye, UserPlus, Shield } from 'lucide-react';

import { RoleSchema } from '@sarwa/contracts';
import { PASSWORD_MIN_LENGTH, useAdminI18n } from '@sarwa/core/admin';
import { Button, Callout, cn, Dialog, Field, Input } from '@sarwa/ui';

import { type UsersPageModel } from './use-users-page';

export function AddUserDialog({ add }: { add: UsersPageModel['add'] }) {
  const { t, f } = useAdminI18n();
  const copy = t.admin.users;
  const errorText = (key: 'email' | 'name' | 'password') => {
    const code = add.errors[key];
    if (!code) return undefined;
    return code === 'emailInvalid'
      ? copy.emailInvalid
      : code === 'passwordShort'
        ? copy.passwordShort({ n: f.number(PASSWORD_MIN_LENGTH) })
        : code === 'exists'
          ? copy.exists
          : copy.required;
  };
  const field = (key: 'email' | 'name' | 'password', type: string, autoComplete: string) => (
    <Field label={copy[key]} error={errorText(key)}>
      {(props) => (
        <Input
          {...props}
          inputSize="lg"
          type={type}
          autoComplete={autoComplete}
          value={add.form[key]}
          onChange={(event) => {
            add.actions.set(key, event.target.value);
          }}
        />
      )}
    </Field>
  );

  return (
    <Dialog
      open={add.open}
      onOpenChange={(open) => {
        if (!open) add.actions.close();
      }}
      title={copy.addTitle}
      description={copy.addBody}
      className="max-w-125"
      footer={
        <>
          <Button variant="ghost" onClick={add.actions.close}>
            {t.common.cancel}
          </Button>
          <Button
            type="submit"
            form="add-user-form"
            loading={add.isSaving}
            icon={<UserPlus aria-hidden className="size-4" />}
          >
            {copy.create}
          </Button>
        </>
      }
    >
      <form
        id="add-user-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          add.actions.submit();
        }}
      >
        {field('email', 'email', 'off')}
        {field('name', 'text', 'off')}
        {field('password', 'password', 'new-password')}
        <div className="flex flex-col gap-1.5">
          <span className="type-sm text-fg font-semibold">{copy.role}</span>
          <div role="radiogroup" aria-label={copy.role} className="grid grid-cols-2 gap-2.5">
            {RoleSchema.options.map((role) => {
              const checked = add.form.role === role;
              return (
                <button
                  key={role}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => {
                    add.actions.set('role', role);
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
                  <span className="type-caption text-fg-3">{copy.roleShort[role]}</span>
                </button>
              );
            })}
          </div>
        </div>
        {add.failed ? (
          <Callout tone="neg" urgent>
            {t.admin.states.actionFailed}
          </Callout>
        ) : null}
      </form>
    </Dialog>
  );
}
