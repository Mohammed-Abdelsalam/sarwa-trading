'use client';

import Link from 'next/link';

import { AUTH_TTL_MS } from '@sarwa/contracts';
import { Field, Input, PasswordInput } from '@sarwa/ui';

import { useCopy } from '../../lib/i18n';
import { DiscardDialog } from '../gating/discard-dialog';
import {
  AuthCard,
  AuthHeading,
  AuthShell,
  CheckboxField,
  FooterLink,
  linkClass,
  OAuthButtons,
  ProblemBanner,
  RetryAnnouncer,
  SubmitButton,
} from './auth-parts';
import { AUTH_ROUTES, fieldMessage } from './auth-view';
import { type SignInView, useSignInPage } from './use-sign-in-page';

const DAY_MS = 86_400_000;

export function SignInForm({ view, submitLabel }: { view: SignInView; submitLabel?: string }) {
  const copy = useCopy();
  const { t, f } = copy;
  const { values, errors, actions } = view;
  const invalid = view.problem === 'INVALID_CREDENTIALS';
  return (
    <>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          actions.submit();
        }}
      >
        {view.problem ? (
          <ProblemBanner
            key={view.problem}
            problem={view.problem}
            retryIn={view.retryIn}
            context="signIn"
          />
        ) : null}
        <RetryAnnouncer ready={view.retryReady} />
        <Field label={t.auth.field.email} error={fieldMessage(copy, errors.email)}>
          {(field) => (
            <Input
              {...field}
              inputSize="lg"
              type="email"
              autoComplete="username"
              placeholder={t.auth.placeholder.email}
              value={values.email}
              disabled={view.isPending}
              onChange={(event) => {
                actions.setEmail(event.target.value);
              }}
            />
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <Field label={t.auth.field.password} error={fieldMessage(copy, errors.password)}>
            {(field) => (
              <PasswordInput
                {...field}
                aria-invalid={field['aria-invalid'] || invalid}
                inputSize="lg"
                autoComplete="current-password"
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
          <Link href={AUTH_ROUTES.forgot} className={`${linkClass} type-sm self-end`}>
            {t.auth.signIn.forgot}
          </Link>
        </div>
        <CheckboxField
          checked={values.keepSignedIn}
          onChange={actions.setKeepSignedIn}
          disabled={view.isPending}
        >
          {t.auth.signIn.keep(f.count(AUTH_TTL_MS.refreshKeepSignedIn / DAY_MS))}
        </CheckboxField>
        <SubmitButton
          label={submitLabel ?? t.auth.signIn.submit}
          loadingLabel={t.auth.signIn.loading}
          isPending={view.isPending}
          retryIn={view.retryIn}
        />
      </form>
      <DiscardDialog
        counts={view.guestData}
        isPending={view.isPending}
        onConfirm={actions.confirmDiscard}
        onCancel={actions.cancelDiscard}
      />
    </>
  );
}

export function SignInPage({ view }: { view: SignInView }) {
  const { t } = useCopy();
  return (
    <AuthShell>
      <AuthCard>
        <AuthHeading title={t.auth.signIn.title} />
        <SignInForm view={view} />
        <OAuthButtons />
        <FooterLink
          lead={t.auth.signIn.newHere}
          label={t.auth.signIn.createLink}
          href={AUTH_ROUTES.signUp}
        />
      </AuthCard>
    </AuthShell>
  );
}

export function SignInScreen() {
  return <SignInPage view={useSignInPage()} />;
}
