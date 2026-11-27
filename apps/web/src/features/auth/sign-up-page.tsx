'use client';

import Link from 'next/link';

import { Field, Input, PasswordInput } from '@sarwa/ui';

import { useCopy } from '../../lib/i18n';
import {
  AuthCard,
  AuthHeading,
  AuthShell,
  CheckboxField,
  FooterLink,
  linkClass,
  OAuthButtons,
  PasswordStrength,
  ProblemBanner,
  RetryAnnouncer,
  SubmitButton,
  TermsText,
} from './auth-parts';
import { AUTH_ROUTES, fieldMessage } from './auth-view';
import { type SignUpView, useSignUpPage } from './use-sign-up-page';

// The page shows the full strength meter; the gate modal a one-line hint and its own submit label.
export function SignUpForm({
  view,
  compact = false,
  submitLabel,
}: {
  view: SignUpView;
  compact?: boolean;
  submitLabel?: string;
}) {
  const copy = useCopy();
  const { t, f } = copy;
  const { values, errors, actions } = view;
  const passwordError = fieldMessage(copy, errors.password);
  return (
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
          action={
            view.problem === 'EMAIL_IN_USE' ? (
              <Link href={AUTH_ROUTES.signIn} className={linkClass}>
                {t.auth.signUp.signInLink}
              </Link>
            ) : undefined
          }
        />
      ) : null}
      <RetryAnnouncer ready={view.retryReady} />
      <Field label={t.auth.field.name} error={fieldMessage(copy, errors.name)}>
        {(field) => (
          <Input
            {...field}
            inputSize="lg"
            autoComplete="name"
            placeholder={t.auth.placeholder.name}
            value={values.name}
            disabled={view.isPending}
            onChange={(event) => {
              actions.setName(event.target.value);
            }}
          />
        )}
      </Field>
      <Field label={t.auth.field.email} error={fieldMessage(copy, errors.email)}>
        {(field) => (
          <Input
            {...field}
            inputSize="lg"
            type="email"
            autoComplete="email"
            placeholder={t.auth.placeholder.email}
            value={values.email}
            disabled={view.isPending}
            onChange={(event) => {
              actions.setEmail(event.target.value);
            }}
          />
        )}
      </Field>
      <Field
        label={t.auth.field.password}
        error={passwordError}
        hint={compact ? t.gate.modal.pwHint({ n: f.number(view.password.minLength) }) : undefined}
      >
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
      {compact ? null : <PasswordStrength check={view.password} />}
      <CheckboxField
        checked={values.terms}
        onChange={actions.setTerms}
        disabled={view.isPending}
        error={fieldMessage(copy, errors.terms)}
      >
        <TermsText variant={compact ? 'modal' : 'page'} />
      </CheckboxField>
      <SubmitButton
        label={submitLabel ?? t.auth.signUp.submit}
        loadingLabel={t.auth.signUp.loading}
        isPending={view.isPending}
        retryIn={view.retryIn}
      />
    </form>
  );
}

export function SignUpPage({ view }: { view: SignUpView }) {
  const { t } = useCopy();
  return (
    <AuthShell>
      <AuthCard>
        <AuthHeading title={t.auth.signUp.title} />
        <SignUpForm view={view} />
        <OAuthButtons />
        <FooterLink
          lead={t.auth.signUp.haveAccount}
          label={t.auth.signUp.signInLink}
          href={AUTH_ROUTES.signIn}
        />
      </AuthCard>
    </AuthShell>
  );
}

export function SignUpScreen() {
  return <SignUpPage view={useSignUpPage()} />;
}
