'use client';

import { CircleCheck, Clock } from 'lucide-react';
import Link from 'next/link';

import { AUTH_TTL_MS } from '@sarwa/contracts';
import { Button, Spinner } from '@sarwa/ui';

import { useCopy } from '../../lib/i18n';
import { AuthCard, AuthHeading, AuthShell, linkClass, StatusIcon } from './auth-parts';
import { AUTH_ROUTES } from './auth-view';
import { type VerifyEmailView, useVerifyEmailPage } from './use-verify-email-page';

const HOUR_MS = 3_600_000;

function Expired({ view }: { view: VerifyEmailView }) {
  const { t, f } = useCopy();
  const duration = t.common.hours(f.count(AUTH_TTL_MS.emailVerify / HOUR_MS));
  return (
    <>
      <AuthHeading
        icon={<StatusIcon tone="warn" icon={<Clock />} />}
        title={t.auth.verify.expiredTitle}
        body={
          view.email
            ? t.auth.verify.expiredBody({ duration, email: view.email })
            : t.auth.verify.expiredBodyNoEmail({ duration })
        }
      />
      {view.email ? (
        <Button
          size="lg"
          loading={view.resend === 'pending'}
          disabled={view.resend === 'sent'}
          onClick={view.actions.resend}
        >
          {t.auth.verify.resend}
        </Button>
      ) : (
        <Button asChild size="lg">
          <Link href={AUTH_ROUTES.signIn}>{t.auth.signIn.submit}</Link>
        </Button>
      )}
      <p role="status" className="type-sm text-pos text-center">
        {view.resend === 'sent' && view.email ? t.auth.verify.sent({ email: view.email }) : ''}
      </p>
      <Link href={AUTH_ROUTES.home} className={`${linkClass} type-sm self-center`}>
        {t.auth.reset.goHome}
      </Link>
    </>
  );
}

export function VerifyEmailPage({ view }: { view: VerifyEmailView }) {
  const { t } = useCopy();
  return (
    <AuthShell>
      <AuthCard>
        {view.status === 'checking' ? (
          <p
            role="status"
            className="type-sm text-fg-2 flex items-center justify-center gap-2 py-6"
          >
            <Spinner />
            {t.auth.verify.checking}
          </p>
        ) : null}
        {view.status === 'ok' ? (
          <>
            <AuthHeading
              icon={<StatusIcon tone="pos" icon={<CircleCheck />} />}
              title={t.auth.verify.okTitle}
              body={view.email ? t.auth.verify.okBody({ email: view.email }) : ''}
            />
            <Button asChild size="lg">
              <Link href={AUTH_ROUTES.home}>{t.auth.verify.continue}</Link>
            </Button>
          </>
        ) : null}
        {view.status === 'expired' ? <Expired view={view} /> : null}
      </AuthCard>
    </AuthShell>
  );
}

export function VerifyEmailScreen() {
  return <VerifyEmailPage view={useVerifyEmailPage()} />;
}
