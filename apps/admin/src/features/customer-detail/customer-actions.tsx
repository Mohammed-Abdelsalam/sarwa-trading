import {
  ArrowRight,
  Ban,
  CircleCheck,
  KeyRound,
  LogOut,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { type ReactNode } from 'react';

import { type CustomerDetail, type SuspensionCategory } from '@sarwa/contracts';
import { cents, SUSPENSION_CATEGORIES } from '@sarwa/core';
import { useAdminI18n } from '@sarwa/core/admin';
import { Button, Callout, Card, Dialog, Field, Input, Select } from '@sarwa/ui';

import { GuardedButton } from '../../components/common/access';

export type CustomerActionKind =
  'suspend' | 'reactivate' | 'signOutAll' | 'sendReset' | 'resetAccount';

export interface CustomerActionView {
  kind: CustomerActionKind | null;
  category: SuspensionCategory;
  reason: string;
  confirm: string;
  // "RESET ACC-7F2E9C": the reset needs it typed exactly.
  phrase: string;
  reasonLimits: { min: number; max: number };
  // Set once a submit failed validation, so errors don't shout while typing.
  reasonInvalid: boolean;
  canSubmit: boolean;
  isSaving: boolean;
  failed: boolean;
  startingCashCents: number;
  actions: {
    open: (kind: CustomerActionKind) => void;
    close: () => void;
    setCategory: (category: SuspensionCategory) => void;
    setReason: (reason: string) => void;
    setConfirm: (text: string) => void;
    submit: () => void;
  };
}

interface Access {
  isViewer: boolean;
  canEdit: boolean;
}

export function ActionsPanel({
  detail,
  action,
  access,
}: {
  detail: CustomerDetail;
  action: CustomerActionView;
  access: Access;
}) {
  const { t, f } = useAdminI18n();
  const copy = t.admin.customer.actions;
  const suspended = detail.customer.status === 'suspended';
  const items: {
    kind: CustomerActionKind;
    label: string;
    hint: string;
    icon: ReactNode;
    variant: 'primary' | 'secondary' | 'danger';
  }[] = [
    suspended
      ? {
          kind: 'reactivate',
          label: copy.reactivate,
          hint: copy.reactivateHint,
          icon: <CircleCheck aria-hidden className="size-4" />,
          variant: 'primary',
        }
      : {
          kind: 'suspend',
          label: copy.suspend,
          hint: copy.suspendHint,
          icon: <Ban aria-hidden className="size-4" />,
          variant: 'danger',
        },
    {
      kind: 'signOutAll',
      label: copy.signOutAll,
      hint: copy.signOutAllHint,
      icon: <LogOut aria-hidden className="size-4" />,
      variant: 'secondary',
    },
    {
      kind: 'sendReset',
      label: copy.sendReset,
      hint: copy.sendResetHint,
      icon: <KeyRound aria-hidden className="size-4" />,
      variant: 'secondary',
    },
    {
      kind: 'resetAccount',
      label: copy.resetAccount,
      hint: copy.resetAccountHint({ amount: f.money(cents(action.startingCashCents)) }),
      icon: <RotateCcw aria-hidden className="size-4" />,
      variant: 'secondary',
    },
  ];

  return (
    <Card className="flex flex-col gap-4 p-5" aria-labelledby="customer-actions">
      <h2 id="customer-actions" className="type-h3 text-fg">
        {copy.title}
      </h2>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.kind} className="flex flex-col gap-1">
            <GuardedButton
              locked={access.isViewer}
              disabled={!access.canEdit}
              variant={item.variant}
              icon={item.icon}
              className="w-full justify-start"
              onClick={() => {
                action.actions.open(item.kind);
              }}
            >
              {item.label}
            </GuardedButton>
            <span className="type-caption text-fg-3">{item.hint}</span>
          </li>
        ))}
      </ul>
      <Callout tone="neutral" icon={<ShieldAlert />}>
        {copy.footer}
      </Callout>
    </Card>
  );
}

const textarea =
  'border-border-strong bg-surface text-fg dark:bg-surface-2 rounded-control-lg type-body min-h-24 w-full resize-y border px-3 py-2.5 outline-none ' +
  'placeholder:text-fg-3 hover:border-fg-3 focus:border-brand focus:ring-3 focus:ring-brand-subtle ' +
  'aria-invalid:border-neg aria-invalid:ring-3 aria-invalid:ring-neg-subtle';

export function CustomerActionDialog({
  detail,
  action,
}: {
  detail: CustomerDetail;
  action: CustomerActionView;
}) {
  const { t, f } = useAdminI18n();
  const copy = t.admin.customer;
  const { customer, portfolio } = detail;
  const name = customer.name;
  const money = (value: number) => f.money(cents(value));
  const kind = action.kind;
  const dialogs: Record<
    CustomerActionKind,
    { title: string; body: string; submit: string; danger: boolean }
  > = {
    suspend: {
      title: copy.suspendDialog.title({ name }),
      body: copy.suspendDialog.body({
        devices: copy.counts.devices(f.count(detail.activeSessions)),
      }),
      submit: copy.suspendDialog.submit,
      danger: true,
    },
    reactivate: {
      title: copy.reactivateDialog.title({ name }),
      body: copy.reactivateDialog.body,
      submit: copy.reactivateDialog.submit,
      danger: false,
    },
    signOutAll: {
      title: copy.signOutDialog.title({ name }),
      body: copy.signOutDialog.body({
        sessions: copy.counts.sessions(f.count(detail.activeSessions)),
      }),
      submit: copy.signOutDialog.submit,
      danger: true,
    },
    sendReset: {
      title: copy.sendResetDialog.title,
      body: copy.sendResetDialog.body({ email: customer.email }),
      submit: copy.sendResetDialog.submit,
      danger: false,
    },
    resetAccount: {
      title: copy.resetDialog.title,
      body: copy.resetDialog.body({
        positions: copy.counts.positions(f.count(portfolio.positions.length)),
        orders: copy.counts.openOrders(f.count(customer.openOrders)),
        amount: money(action.startingCashCents),
      }),
      submit: copy.resetDialog.submit,
      danger: true,
    },
  };
  const dialog = kind ? dialogs[kind] : null;
  const limits = {
    min: f.number(action.reasonLimits.min),
    max: f.number(action.reasonLimits.max),
  };
  const hint = copy.reasonHint(limits);

  return (
    <Dialog
      open={dialog !== null}
      onOpenChange={(open) => {
        if (!open) action.actions.close();
      }}
      title={dialog?.title ?? ''}
      description={dialog?.body}
      className="max-w-130"
      footer={
        <>
          <Button variant="ghost" onClick={action.actions.close}>
            {t.common.cancel}
          </Button>
          <Button
            type="submit"
            form="customer-action-form"
            variant={dialog?.danger ? 'danger' : 'primary'}
            disabled={!action.canSubmit}
            loading={action.isSaving}
          >
            {dialog?.submit}
          </Button>
        </>
      }
    >
      <form
        id="customer-action-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          action.actions.submit();
        }}
      >
        {kind === 'resetAccount' ? (
          <div className="bg-surface-3 flex items-center justify-between gap-3 rounded-lg px-4 py-3">
            <span className="flex flex-col">
              <span className="type-caption text-fg-3">{copy.resetDialog.equityNow}</span>
              <b className="type-num-md text-fg">{money(portfolio.equityCents)}</b>
            </span>
            <ArrowRight aria-hidden className="text-fg-3 size-4 rtl:-scale-x-100" />
            <span className="flex flex-col text-end">
              <span className="type-caption text-fg-3">{copy.resetDialog.afterReset}</span>
              <b className="type-num-md text-fg">{money(action.startingCashCents)}</b>
            </span>
          </div>
        ) : null}
        {kind === 'suspend' ? (
          <Field label={copy.suspendDialog.category}>
            {(field) => (
              <Select
                {...field}
                value={action.category}
                onChange={(event) => {
                  action.actions.setCategory(event.target.value as SuspensionCategory);
                }}
              >
                {SUSPENSION_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t.admin.customers.reasonCategories[category]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
        <Field
          label={kind === 'suspend' ? copy.suspendDialog.reason : copy.reason}
          hint={hint}
          error={action.reasonInvalid ? hint : undefined}
        >
          {(field) => (
            <textarea
              {...field}
              className={textarea}
              maxLength={action.reasonLimits.max}
              value={action.reason}
              onChange={(event) => {
                action.actions.setReason(event.target.value);
              }}
            />
          )}
        </Field>
        <span className="type-caption text-fg-3 -mt-3 self-end tabular-nums" aria-hidden>
          {copy.reasonCount({
            n: f.number(action.reason.trim().length),
            max: limits.max,
          })}
        </span>
        {kind === 'resetAccount' ? (
          <Field label={copy.resetDialog.type({ phrase: action.phrase })}>
            {(field) => (
              <Input
                {...field}
                autoComplete="off"
                spellCheck={false}
                className="type-mono"
                placeholder={action.phrase}
                value={action.confirm}
                onChange={(event) => {
                  action.actions.setConfirm(event.target.value);
                }}
              />
            )}
          </Field>
        ) : null}
        {action.failed ? (
          <Callout tone="neg" urgent>
            {t.admin.states.actionFailed}
          </Callout>
        ) : null}
      </form>
    </Dialog>
  );
}
