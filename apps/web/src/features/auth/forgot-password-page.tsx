'use client';

import { MailCheck } from 'lucide-react';
import Link from 'next/link';

import { AUTH_TTL_MS } from '@sarwa/contracts';
import { Button, Field, Input } from '@sarwa/ui';

import { useCopy } from '../../lib/i18n';
import {
  AuthCard,
  AuthHeading,
  AuthShell,
  linkClass,
  ProblemBanner,
  RetryAnnouncer,
  StatusIcon,
  SubmitButton,
} from './auth-parts';
import { AUTH_ROUTES, fieldMessage } from './auth-view';
import { type ForgotPasswordView, useForgotPasswordPage } from './use-forgot-password-page';

const MINUTE_MS = 60_000;

function BackToSignIn() {
  const { t } = useCopy();
  return (
    <Link href={AUTH_ROUTES.signIn} className={`${linkClass} type-sm self-center`}>
      {t.auth.backToSignIn}
    </Link>
  );
}

function SentStep({ view }: { view: ForgotPasswordView }) {
  const { t, f } = useCopy();
  return (
    <>
      <AuthHeading
        icon={<StatusIcon tone="brand" icon={<MailCheck />} />}
        title={t.auth.forgot.sentTitle}
        body={t.auth.forgot.sentBody({
          email: view.email,
          duration: t.counts.minutes(f.count(AUTH_TTL_MS.passwordReset / MINUTE_MS)),
        })}
      />
      <Button asChild size="lg" variant="secondary">
        <a href="mailto:">{t.auth.forgot.openEmail}</a>
      </Button>
      {view.resendIn ? (
        <p className="type-sm text-fg-2 text-center tabular-nums">
          {t.auth.forgot.resendIn({ time: view.resendIn })}
        </p>
      ) : (
        <Button
          variant="ghost"
          className="self-center"
          loading={view.isPending}
          onClick={view.actions.resend}
        >
          {t.auth.forgot.resend}
        </Button>
      )}
    </>
  );
}

export function ForgotPasswordPage({ view }: { view: ForgotPasswordView }) {
  const copy = useCopy();
  const { t } = copy;
  return (
    <AuthShell>
      <AuthCard>
        {view.step === 'sent' ? (
          <SentStep view={view} />
        ) : (
          <>
            <AuthHeading title={t.auth.forgot.title} body={t.auth.forgot.body} />
            <form
              noValidate
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                view.actions.submit();
              }}
            >
              {view.problem ? (
                <ProblemBanner key={view.problem} problem={view.problem} retryIn={view.retryIn} />
              ) : null}
              <RetryAnnouncer ready={view.retryReady} />
              <Field label={t.auth.field.email} error={fieldMessage(copy, view.error)}>
                {(field) => (
                  <Input
                    {...field}
                    inputSize="lg"
                    type="email"
                    autoComplete="email"
                    placeholder={t.auth.placeholder.email}
                    value={view.email}
                    disabled={view.isPending}
                    onChange={(event) => {
                      view.actions.setEmail(event.target.value);
                    }}
                  />
                )}
              </Field>
              <SubmitButton
                label={t.auth.forgot.submit}
                loadingLabel={t.auth.forgot.sending}
                isPending={view.isPending}
                retryIn={view.retryIn}
              />
            </form>
          </>
        )}
        <BackToSignIn />
      </AuthCard>
    </AuthShell>
  );
}

export function ForgotPasswordScreen() {
  return <ForgotPasswordPage view={useForgotPasswordPage()} />;
}
