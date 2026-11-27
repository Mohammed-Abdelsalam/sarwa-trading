'use client';

import { CircleCheck, Clock, TriangleAlert } from 'lucide-react';
import Link from 'next/link';

import { AUTH_TTL_MS } from '@sarwa/contracts';
import { Button, Callout, Field, PasswordInput, Spinner } from '@sarwa/ui';

import { useCopy } from '../../lib/i18n';
import {
  AuthCard,
  AuthHeading,
  AuthShell,
  PasswordStrength,
  ProblemBanner,
  RetryAnnouncer,
  StatusIcon,
  SubmitButton,
} from './auth-parts';
import { AUTH_ROUTES, fieldMessage } from './auth-view';
import { type ResetPasswordView, useResetPasswordPage } from './use-reset-password-page';

const MINUTE_MS = 60_000;

function ResetForm({ view }: { view: ResetPasswordView }) {
  const copy = useCopy();
  const { t } = copy;
  const { values, errors, actions } = view;
  return (
    <>
      <AuthHeading
        title={t.auth.reset.title}
        body={view.email ? t.auth.reset.for({ email: view.email }) : ''}
      />
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          actions.submit();
        }}
      >
        {view.problem ? (
          <ProblemBanner key={view.problem} problem={view.problem} retryIn={view.retryIn} />
        ) : null}
        <RetryAnnouncer ready={view.retryReady} />
        <Field label={t.auth.reset.new} error={fieldMessage(copy, errors.password)}>
          {(field) => (
            <PasswordInput
              {...field}
              inputSize="lg"
              autoComplete="new-password"
              showLabel={t.auth.showPassword}
              hideLabel={t.auth.hidePassword}
              value={values.password}
              disabled={view.isPending}
              onChange={(event) => {
                actions.setPassword(event.target.value);
              }}
            />
          )}
        </Field>
        <PasswordStrength check={view.password} tip={false} />
        <Field
          label={t.auth.reset.confirm}
          error={fieldMessage(copy, errors.confirm)}
          hint={view.matches ? t.auth.reset.match : undefined}
        >
          {(field) => (
            <PasswordInput
              {...field}
              inputSize="lg"
              autoComplete="new-password"
              showLabel={t.auth.showPassword}
              hideLabel={t.auth.hidePassword}
              value={values.confirm}
              disabled={view.isPending}
              onChange={(event) => {
                actions.setConfirm(event.target.value);
              }}
            />
          )}
        </Field>
        <Callout tone="warn" icon={<TriangleAlert />}>
          {t.auth.reset.warn}
        </Callout>
        <SubmitButton
          label={t.auth.reset.submit}
          loadingLabel={t.auth.reset.loading}
          isPending={view.isPending}
          retryIn={view.retryIn}
        />
      </form>
    </>
  );
}

export function ResetPasswordPage({ view }: { view: ResetPasswordView }) {
  const { t, f, m } = useCopy();
  return (
    <AuthShell>
      <AuthCard>
        {view.status === 'checking' ? (
          <p
            role="status"
            className="type-sm text-fg-2 flex items-center justify-center gap-2 py-6"
          >
            <Spinner />
            {m.loading}
          </p>
        ) : null}
        {view.status === 'form' ? <ResetForm view={view} /> : null}
        {view.status === 'done' ? (
          <>
            <AuthHeading
              icon={<StatusIcon tone="pos" icon={<CircleCheck />} />}
              title={t.auth.reset.doneTitle}
              body={t.auth.reset.doneBody({
                sessions: t.counts.sessions(f.count(view.sessionsRevoked)),
              })}
            />
            <Button asChild size="lg">
              <Link href={AUTH_ROUTES.home}>{t.auth.reset.goHome}</Link>
            </Button>
            <p className="type-caption text-fg-3 text-center">{t.auth.reset.notice}</p>
          </>
        ) : null}
        {view.status === 'expired' ? (
          <>
            <AuthHeading
              icon={<StatusIcon tone="warn" icon={<Clock />} />}
              title={t.auth.reset.expiredTitle}
              body={t.auth.reset.expiredBody({
                duration: t.counts.minutes(f.count(AUTH_TTL_MS.passwordReset / MINUTE_MS)),
              })}
            />
            <Button asChild size="lg">
              <Link href={AUTH_ROUTES.forgot}>{t.auth.reset.requestNew}</Link>
            </Button>
          </>
        ) : null}
      </AuthCard>
    </AuthShell>
  );
}

export function ResetPasswordScreen() {
  return <ResetPasswordPage view={useResetPasswordPage()} />;
}
