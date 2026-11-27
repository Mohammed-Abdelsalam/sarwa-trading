'use client';

import { Check, ChevronLeft, CircleAlert, Clock, TriangleAlert, WifiOff, X } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

import { POLICY } from '@sarwa/core';
import {
  Badge,
  Button,
  Callout,
  type CalloutTone,
  Card,
  cn,
  Logo,
  PasswordStrengthMeter,
} from '@sarwa/ui';

import { type Copy, useCopy } from '../../lib/i18n';
import { AUTH_ROUTES, type AuthProblem, type PasswordCheck } from './auth-view';

export const linkClass =
  'text-brand-fg focus-visible:outline-focus rounded-xs font-semibold hover:underline focus-visible:outline-2';

// Auth pages replace the app chrome: logo, "Back to markets" and one centered card.
export function AuthShell({ children }: { children: ReactNode }) {
  const { t, m } = useCopy();
  return (
    <div className="bg-bg flex min-h-dvh flex-col">
      <a
        href="#main"
        className="bg-brand text-on-brand sr-only z-50 rounded-md px-4 py-2 font-semibold focus:not-sr-only focus:absolute focus:start-4 focus:top-3"
      >
        {m.nav.skip}
      </a>
      <header className="border-border bg-surface flex h-16 items-center justify-between gap-3 border-b px-4 md:px-7">
        <Link
          href={AUTH_ROUTES.home}
          className="focus-visible:outline-focus rounded-sm focus-visible:outline-2"
        >
          <Logo />
        </Link>
        <Link
          href={AUTH_ROUTES.markets}
          className={cn(linkClass, 'type-sm inline-flex items-center gap-1')}
        >
          <ChevronLeft aria-hidden className="size-3.5 rtl:-scale-x-100" />
          {t.auth.backToMarkets}
        </Link>
      </header>
      <main
        id="main"
        className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:py-12"
      >
        {children}
      </main>
    </div>
  );
}

export function AuthCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card className={cn('flex w-full max-w-110 flex-col gap-4 px-5 py-7 sm:px-8', className)}>
      {children}
    </Card>
  );
}

export function AuthHeading({
  title,
  body,
  icon,
}: {
  title: string;
  body?: ReactNode;
  icon?: ReactNode;
}) {
  const { t, f } = useCopy();
  return (
    <div className="flex flex-col items-center gap-2 pb-1 text-center">
      <span aria-hidden>
        {icon ?? (
          <Logo
            showName={false}
            className="[&>span:first-child]:size-11 [&>span:first-child]:rounded-lg"
          />
        )}
      </span>
      <h1 className="type-h2 text-fg">{title}</h1>
      <p className="type-sm text-fg-2">
        {body ?? t.auth.valueLine({ amount: f.money(POLICY.startingCashCents, { whole: true }) })}
      </p>
    </div>
  );
}

interface ProblemCopy {
  tone: CalloutTone;
  icon: ReactNode;
  title: string;
  hint?: string;
}

function problemCopy(
  { t }: Copy,
  problem: AuthProblem,
  retryIn: string,
  context: 'signIn' | 'other',
): ProblemCopy {
  const errors = t.auth.errors;
  if (problem === 'RATE_LIMITED')
    return {
      tone: 'warn',
      icon: <Clock />,
      title: errors.RATE_LIMITED({ time: retryIn }),
      hint: context === 'signIn' ? t.auth.rateLimitedHint : undefined,
    };
  if (problem === 'OFFLINE')
    return {
      tone: 'neutral',
      icon: <WifiOff />,
      title: context === 'signIn' ? t.auth.offlineSignIn : errors.OFFLINE,
    };
  if (problem === 'INVALID_CREDENTIALS')
    return {
      tone: 'neg',
      icon: <CircleAlert />,
      title: errors.INVALID_CREDENTIALS,
      hint: t.auth.signIn.invalidHint,
    };
  return { tone: 'neg', icon: <TriangleAlert />, title: errors[problem] };
}

// The top banner: announced once and focused, so a keyboard user lands on what went wrong.
export function ProblemBanner({
  problem,
  retryIn,
  context = 'other',
  action,
}: {
  problem: AuthProblem;
  retryIn?: string | null;
  context?: 'signIn' | 'other';
  action?: ReactNode;
}) {
  const copy = useCopy();
  const ref = useRef<HTMLDivElement>(null);
  // The ticking countdown stays out of the live region; readers hear the time once.
  const [announced] = useState(() => problemCopy(copy, problem, retryIn ?? '', context));
  const shown = problemCopy(copy, problem, retryIn ?? '', context);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <Callout
      ref={ref}
      tabIndex={-1}
      urgent
      tone={shown.tone}
      icon={shown.icon}
      className="focus:outline-none"
    >
      <span className="sr-only">{announced.title}</span>
      <b aria-hidden className="block font-semibold tabular-nums">
        {shown.title}
      </b>
      {shown.hint ? <span className="text-fg-2 block">{shown.hint}</span> : null}
      {action}
    </Callout>
  );
}

// A polite "You can try again now" once a rate-limit countdown ends; always mounted so it is heard.
export function RetryAnnouncer({ ready }: { ready: boolean }) {
  const { t } = useCopy();
  return (
    <p role="status" className="sr-only">
      {ready ? t.auth.retryReady : ''}
    </p>
  );
}

export function SubmitButton({
  label,
  loadingLabel,
  isPending,
  retryIn,
  disabled,
}: {
  label: string;
  loadingLabel: string;
  isPending: boolean;
  retryIn?: string | null;
  disabled?: boolean;
}) {
  const { t } = useCopy();
  if (retryIn)
    return (
      <Button
        type="button"
        variant="secondary"
        size="lg"
        disabled
        icon={<Clock aria-hidden className="size-4" />}
      >
        {t.auth.retryIn({ time: retryIn })}
      </Button>
    );
  return (
    <Button type="submit" size="lg" loading={isPending} disabled={disabled}>
      {isPending ? loadingLabel : label}
    </Button>
  );
}

export function PasswordStrength({ check, tip = true }: { check: PasswordCheck; tip?: boolean }) {
  const { t, f } = useCopy();
  const copy = t.auth.strength;
  const levels = [
    undefined,
    copy.levels.weak,
    copy.levels.fair,
    copy.levels.good,
    copy.levels.strong,
  ];
  const rules = [
    { label: copy.minLength({ n: f.number(check.minLength) }), ok: check.longEnough },
    { label: copy.notCommon, ok: check.longEnough && check.notCommon },
  ];
  if (tip && check.strength >= 2) rules.push({ label: copy.tip, ok: check.hasNumberOrSymbol });
  return (
    <div className="flex flex-col gap-1.5">
      <PasswordStrengthMeter
        strength={check.strength}
        label={copy.label}
        levelLabel={levels[check.strength]}
      />
      <ul className="type-caption flex flex-col gap-1">
        {rules.map((rule) => (
          <li
            key={rule.label}
            data-ok={rule.ok}
            className={cn('flex items-center gap-1.5', rule.ok ? 'text-pos' : 'text-fg-3')}
          >
            {rule.ok ? (
              <Check aria-hidden className="size-3.5" />
            ) : (
              <X aria-hidden className="size-3.5" />
            )}
            {rule.label}
            <span className="sr-only">, {rule.ok ? copy.met : copy.notMet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// "I agree to the Terms and Privacy Policy…": the full line on the page, the short one in the gate.
export function TermsText({ variant }: { variant: 'page' | 'modal' }) {
  const { t } = useCopy();
  const copy = t.auth.terms[variant];
  return (
    <>
      {copy.prefix}
      <b className="text-fg font-semibold">{copy.termsLink}</b>
      {copy.and}
      <b className="text-fg font-semibold">{copy.privacyLink}</b>
      {copy.suffix}
    </>
  );
}

export function CheckboxField({
  checked,
  onChange,
  disabled,
  error,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  error?: string;
  children: ReactNode;
}) {
  const errorId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label className="type-sm text-fg-2 flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          className="accent-brand mt-0.5 size-4.5 shrink-0"
          checked={checked}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
        />
        <span>{children}</span>
      </label>
      {error ? (
        <p id={errorId} role="alert" className="text-neg text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Google and Apple are placeholders: focusable so "coming soon" is announced, never actionable.
export function OAuthButtons() {
  const { t } = useCopy();
  const providers = [t.auth.oauth.google, t.auth.oauth.apple];
  return (
    <>
      <div className="type-caption text-fg-3 before:bg-border after:bg-border flex items-center gap-3 before:h-px before:flex-1 after:h-px after:flex-1">
        {t.auth.or}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {providers.map((provider) => (
          <Button
            key={provider}
            type="button"
            variant="secondary"
            aria-disabled
            aria-label={t.auth.oauth.comingSoonA11y({ provider })}
            className="cursor-not-allowed opacity-60"
          >
            {provider}
            <Badge tone="neutral">{t.auth.oauth.soon}</Badge>
          </Button>
        ))}
      </div>
    </>
  );
}

export function FooterLink({ lead, label, href }: { lead: string; label: string; href: AuthHref }) {
  return (
    <p className="type-sm text-fg-2 text-center">
      {lead}{' '}
      <Link href={href} className={linkClass}>
        {label}
      </Link>
    </p>
  );
}

type AuthHref = (typeof AUTH_ROUTES)[keyof typeof AUTH_ROUTES];

const STATUS_TONE = {
  brand: 'bg-brand-subtle text-brand-fg',
  pos: 'bg-pos-subtle text-pos',
  warn: 'bg-warn-subtle text-warn',
  neg: 'bg-neg-subtle text-neg',
} as const;

// The round glyph that heads the sent, success and expired states.
export function StatusIcon({ tone, icon }: { tone: keyof typeof STATUS_TONE; icon: ReactNode }) {
  return (
    <span
      className={cn(
        'grid size-12 place-items-center rounded-full [&>svg]:size-6',
        STATUS_TONE[tone],
      )}
    >
      {icon}
    </span>
  );
}
