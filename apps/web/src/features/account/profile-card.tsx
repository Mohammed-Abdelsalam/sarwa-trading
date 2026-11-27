'use client';

import { type ReactNode } from 'react';

import { POLICY } from '@sarwa/core';
import { Badge, Button, Card, Dialog, Field, Input } from '@sarwa/ui';

import { useCopy } from '../../lib/i18n';
import { fieldMessage } from '../auth/auth-view';
import { type ProfileView } from './use-security-page';

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

function EditProfileDialog({ view }: { view: ProfileView }) {
  const copy = useCopy();
  const { t } = copy;
  const { edit, actions } = view;
  return (
    <Dialog
      open={edit.open}
      onOpenChange={(open) => {
        if (!open) actions.closeEdit();
      }}
      title={t.account.profile.editTitle}
      closeLabel={t.common.close}
    >
      <form
        noValidate
        id="edit-profile"
        onSubmit={(event) => {
          event.preventDefault();
          actions.saveName();
        }}
      >
        <Field label={t.account.profile.nameLabel} error={fieldMessage(copy, edit.error)}>
          {(field) => (
            <Input
              {...field}
              autoComplete="name"
              value={edit.name}
              disabled={edit.isPending}
              onChange={(event) => {
                actions.setName(event.target.value);
              }}
            />
          )}
        </Field>
      </form>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={actions.closeEdit} disabled={edit.isPending}>
          {t.common.cancel}
        </Button>
        <Button type="submit" form="edit-profile" loading={edit.isPending}>
          {t.account.profile.save}
        </Button>
      </div>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-border flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t py-3">
      <dt className="type-sm text-fg-2">{label}</dt>
      <dd className="type-sm flex items-center gap-2 font-semibold">{children}</dd>
    </div>
  );
}

export function ProfileCard({ view }: { view: ProfileView }) {
  const { t, f } = useCopy();
  const copy = t.account.profile;
  const { user, actions } = view;
  return (
    <Card id="profile" className="flex scroll-mt-24 flex-col gap-4 px-5 py-4.5">
      <h2 className="type-h3">{copy.title}</h2>
      <div className="flex flex-wrap items-center gap-3.5">
        <span
          aria-hidden
          className="bg-brand-subtle text-brand-fg type-h3 grid size-12 place-items-center rounded-full"
        >
          {initial(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <b className="type-body block truncate">{user.name}</b>
          <span className="type-caption text-fg-3">
            {copy.memberSince({ date: f.date(user.createdAt) })}
          </span>
        </div>
        <Button variant="secondary" size="sm" onClick={actions.openEdit}>
          {copy.edit}
        </Button>
      </div>
      <dl>
        <Row label={copy.email}>
          <span className="break-all">{user.email}</span>
          {user.emailVerified ? (
            <Badge tone="pos">{copy.verified}</Badge>
          ) : (
            <>
              <Badge tone="warn">{copy.unverified}</Badge>
              <Button
                variant="ghost"
                size="sm"
                loading={view.resend === 'pending'}
                disabled={view.resend === 'sent'}
                onClick={actions.resendVerification}
              >
                {view.resend === 'sent' ? t.verifyBanner.sent : copy.resend}
              </Button>
            </>
          )}
        </Row>
        <Row label={copy.accountId}>
          <span className="type-mono">{user.account.handle}</span>
        </Row>
        <Row label={copy.practiceLabel}>
          {copy.practice({ amount: f.money(POLICY.startingCashCents, { whole: true }) })}
        </Row>
      </dl>
      <EditProfileDialog view={view} />
    </Card>
  );
}
