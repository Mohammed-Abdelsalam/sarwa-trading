'use client';

import { ArrowRight } from 'lucide-react';
import { type ReactNode } from 'react';

import { AUTH_TTL_MS, DELETE_CONFIRM, RESET_CONFIRM } from '@sarwa/contracts';
import { cents, POLICY } from '@sarwa/core';
import { Button, Card, Dialog, Field, Input, PasswordInput } from '@sarwa/ui';

import { useCopy } from '../../lib/i18n';
import { fieldMessage } from '../auth/auth-view';
import { SettingsLayout } from './settings-layout';
import { type DangerPageView } from './use-danger-page';

const DAY_MS = 86_400_000;

function DangerRow({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <div className="border-border flex flex-wrap items-center gap-3 border-t py-4 first:border-t-0">
      <div className="min-w-0 flex-1 basis-60">
        <b className="type-sm block">{title}</b>
        <span className="type-caption text-fg-3">{body}</span>
      </div>
      {action}
    </div>
  );
}

function ConfirmWord({
  word,
  value,
  onChange,
  disabled,
  error,
}: {
  word: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error?: string;
}) {
  const { t } = useCopy();
  return (
    <Field
      label={t.account.deleteDialog.type({ word })}
      hint={t.account.deleteDialog.caseSensitive}
      error={error}
    >
      {(field) => (
        <Input
          {...field}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="type-mono"
          value={value}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      )}
    </Field>
  );
}

function DeleteDialog({ view }: { view: DangerPageView }) {
  const copy = useCopy();
  const { t, f } = copy;
  const { deletion, summary, actions } = view;
  const ready = deletion.confirm === DELETE_CONFIRM && deletion.password.length > 0;
  return (
    <Dialog
      open={view.dialog === 'delete'}
      onOpenChange={(open) => {
        if (!open) actions.close();
      }}
      title={t.account.deleteDialog.title}
      description={
        summary
          ? t.account.deleteDialog.body({
              equity: f.money(cents(summary.equityCents)),
              orders: t.counts.openOrders(f.count(summary.openOrders)),
              watchlists: t.counts.watchlist(f.count(summary.watchlist)),
              alerts: t.counts.alerts(f.count(summary.alerts)),
              days: t.counts.days(f.count(AUTH_TTL_MS.deletionGrace / DAY_MS)),
            })
          : undefined
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) actions.submitDelete();
        }}
      >
        <Field
          label={t.account.deleteDialog.password}
          error={
            deletion.passwordIncorrect
              ? t.auth.errors.INVALID_CURRENT_PASSWORD
              : fieldMessage(copy, deletion.errors.password)
          }
        >
          {(field) => (
            <PasswordInput
              {...field}
              autoComplete="current-password"
              showLabel={t.auth.showPassword}
              hideLabel={t.auth.hidePassword}
              value={deletion.password}
              disabled={deletion.isPending}
              onChange={(event) => {
                actions.setDeletePassword(event.target.value);
              }}
            />
          )}
        </Field>
        <ConfirmWord
          word={DELETE_CONFIRM}
          value={deletion.confirm}
          onChange={actions.setDeleteConfirm}
          disabled={deletion.isPending}
          error={fieldMessage(copy, deletion.errors.confirm)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={actions.close} disabled={deletion.isPending}>
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="danger" disabled={!ready} loading={deletion.isPending}>
            {deletion.isPending ? t.account.deleteDialog.deleting : t.account.deleteDialog.confirm}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ResetDialog({ view }: { view: DangerPageView }) {
  const { t, f } = useCopy();
  const { reset, summary, actions } = view;
  const start = f.money(POLICY.startingCashCents);
  const ready = reset.confirm === RESET_CONFIRM;
  return (
    <Dialog
      open={view.dialog === 'reset'}
      onOpenChange={(open) => {
        if (!open) actions.close();
      }}
      title={t.account.resetDialog.title}
      description={
        summary
          ? t.account.resetDialog.body({
              positions: t.counts.positions(f.count(summary.positions)),
              orders: t.counts.openOrders(f.count(summary.openOrders)),
              amount: start,
            })
          : undefined
      }
    >
      {summary ? (
        <dl className="border-border bg-surface-3 flex items-center justify-between gap-3 rounded-md border px-4 py-3">
          <div>
            <dt className="type-caption text-fg-3">{t.account.resetDialog.equityNow}</dt>
            <dd className="type-num-md">{f.money(cents(summary.equityCents))}</dd>
          </div>
          <ArrowRight aria-hidden className="text-fg-3 size-4 rtl:-scale-x-100" />
          <div className="text-end">
            <dt className="type-caption text-fg-3">{t.account.resetDialog.afterReset}</dt>
            <dd className="type-num-md">{start}</dd>
          </div>
        </dl>
      ) : null}
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) actions.submitReset();
        }}
      >
        <ConfirmWord
          word={RESET_CONFIRM}
          value={reset.confirm}
          onChange={actions.setResetConfirm}
          disabled={reset.isPending}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={actions.close} disabled={reset.isPending}>
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="danger" disabled={!ready} loading={reset.isPending}>
            {reset.isPending ? t.account.resetDialog.resetting : t.account.resetDialog.confirm}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function DangerZone({ view }: { view: DangerPageView }) {
  const { t, f } = useCopy();
  const copy = t.account.danger;
  const { actions } = view;
  return (
    <Card className="border-neg/35 flex flex-col px-5 py-4.5">
      <h2 className="type-h3 text-neg pb-1">{copy.title}</h2>
      <DangerRow
        title={copy.signOutTitle}
        body={copy.signOutBody}
        action={
          <Button variant="secondary" loading={view.isSigningOut} onClick={actions.signOut}>
            {copy.signOutTitle}
          </Button>
        }
      />
      <DangerRow
        title={copy.resetTitle}
        body={copy.resetBody({ amount: f.money(POLICY.startingCashCents, { whole: true }) })}
        action={
          <Button
            variant="secondary"
            onClick={() => {
              actions.open('reset');
            }}
          >
            {copy.resetAction}
          </Button>
        }
      />
      <DangerRow
        title={copy.deleteTitle}
        body={copy.deleteBody({
          days: t.counts.days(f.count(AUTH_TTL_MS.deletionGrace / DAY_MS)),
        })}
        action={
          <Button
            variant="danger"
            onClick={() => {
              actions.open('delete');
            }}
          >
            {copy.deleteAction}
          </Button>
        }
      />
      <DeleteDialog view={view} />
      <ResetDialog view={view} />
    </Card>
  );
}

export function DangerSettingsPage({ view }: { view: DangerPageView }) {
  return (
    <SettingsLayout section="danger">
      <DangerZone view={view} />
    </SettingsLayout>
  );
}
