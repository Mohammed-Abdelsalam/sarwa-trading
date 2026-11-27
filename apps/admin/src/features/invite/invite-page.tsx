'use client';

import { Eye, EyeOff, LinkIcon, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode } from 'react';

import { type InviteInfo } from '@sarwa/contracts';
import { type PasswordStrength } from '@sarwa/core';
import { useAdminI18n } from '@sarwa/core/admin';
import {
  Badge,
  Button,
  buttonVariants,
  Callout,
  Card,
  cn,
  Field,
  IconButton,
  Input,
  Logo,
  Skeleton,
  StateView,
} from '@sarwa/ui';

import { useInvitePage } from './use-invite-page';

type InviteFieldError = keyof ReturnType<
  typeof useAdminI18n
>['t']['admin']['invite']['fieldErrors'];

export interface InviteView {
  status: 'loading' | 'invalid' | 'ready';
  info: InviteInfo | null;
  name: string;
  password: string;
  showPassword: boolean;
  strength: PasswordStrength;
  errors: { name?: InviteFieldError; password?: InviteFieldError };
  limits: { nameMax: number; passwordMin: number; passwordMax: number };
  isSubmitting: boolean;
  failed: boolean;
  actions: {
    setName: (name: string) => void;
    setPassword: (password: string) => void;
    toggleShowPassword: () => void;
    submit: () => void;
  };
}

const LEVELS = ['weak', 'fair', 'good', 'strong'] as const;
const SEGMENT_TONE = ['bg-neg', 'bg-warn', 'bg-info', 'bg-pos'] as const;

function StrengthMeter({ strength }: { strength: PasswordStrength }) {
  const { t } = useAdminI18n();
  const copy = t.auth.strength;
  const level = strength > 0 ? LEVELS[strength - 1] : null;
  const tone = strength > 0 ? SEGMENT_TONE[strength - 1] : null;
  return (
    <div className="flex items-center gap-3">
      <div aria-hidden className="grid flex-1 grid-cols-4 gap-1">
        {LEVELS.map((key, i) => (
          <span
            key={key}
            className={cn(
              'h-1.5 rounded-full transition-colors duration-200',
              tone && i < strength ? tone : 'bg-surface-3',
            )}
          />
        ))}
      </div>
      <span className="type-caption text-fg-2 min-w-12 text-end font-semibold">
        <span className="sr-only">{copy.label} </span>
        {level ? copy.levels[level] : null}
      </span>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { t, dir } = useAdminI18n();
  return (
    <div dir={dir} className="bg-bg grid min-h-dvh place-items-center p-6">
      <main className="flex w-full max-w-110 flex-col gap-6">
        <span className="flex items-center justify-center gap-2.5">
          <Logo />
          <Badge tone="brand">{t.admin.shell.admin}</Badge>
        </span>
        <Card className="flex flex-col gap-5 p-8 max-sm:p-5">{children}</Card>
      </main>
    </div>
  );
}

export function InvitePage({ view }: { view: InviteView }) {
  const { t, f } = useAdminI18n();
  const copy = t.admin.invite;
  const fieldError = (code: InviteFieldError | undefined, n: number) =>
    code ? copy.fieldErrors[code]({ n: f.number(n) }) : undefined;

  if (view.status === 'invalid') {
    return (
      <Shell>
        <StateView
          icon={<LinkIcon />}
          title={copy.expiredTitle}
          description={copy.expiredBody}
          action={
            <Link href="/login" className={buttonVariants({ variant: 'secondary' })}>
              {copy.backToLogin}
            </Link>
          }
        />
      </Shell>
    );
  }
  if (view.status === 'loading' || !view.info) {
    return (
      <Shell>
        <div aria-busy="true" className="flex flex-col gap-4">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </Shell>
    );
  }

  const { info, limits } = view;
  const passwordError =
    view.errors.password === 'PASSWORD_TOO_LONG'
      ? fieldError(view.errors.password, limits.passwordMax)
      : fieldError(view.errors.password, limits.passwordMin);

  return (
    <Shell>
      <form
        noValidate
        aria-labelledby="invite-title"
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          view.actions.submit();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <h1 id="invite-title" className="type-h1 text-fg">
            {copy.title}
          </h1>
          <p className="type-sm text-fg-2">
            {copy.subtitle({ email: info.email, role: t.admin.roles[info.role] })}
          </p>
        </div>
        {view.failed ? (
          <Callout tone="neg" icon={<TriangleAlert />} urgent>
            {t.admin.states.actionFailed}
          </Callout>
        ) : null}
        <Field label={copy.name} error={fieldError(view.errors.name, limits.nameMax)}>
          {(field) => (
            <Input
              {...field}
              inputSize="lg"
              autoComplete="name"
              maxLength={limits.nameMax}
              value={view.name}
              disabled={view.isSubmitting}
              onChange={(event) => {
                view.actions.setName(event.target.value);
              }}
            />
          )}
        </Field>
        <Field
          label={copy.password}
          hint={copy.passwordHint({ n: f.number(limits.passwordMin) })}
          error={passwordError}
        >
          {(field) => (
            <div className="relative">
              <Input
                {...field}
                inputSize="lg"
                type={view.showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="pe-12"
                value={view.password}
                disabled={view.isSubmitting}
                onChange={(event) => {
                  view.actions.setPassword(event.target.value);
                }}
              />
              <IconButton
                size={32}
                label={view.showPassword ? t.admin.login.hidePassword : t.admin.login.showPassword}
                aria-pressed={view.showPassword}
                className="absolute end-1.5 top-1/2 -translate-y-1/2"
                onClick={view.actions.toggleShowPassword}
              >
                {view.showPassword ? (
                  <EyeOff aria-hidden className="size-4" />
                ) : (
                  <Eye aria-hidden className="size-4" />
                )}
              </IconButton>
            </div>
          )}
        </Field>
        <StrengthMeter strength={view.strength} />
        <Button type="submit" size="lg" loading={view.isSubmitting}>
          {view.isSubmitting ? copy.loading : copy.submit}
        </Button>
      </form>
    </Shell>
  );
}

export function InviteScreen({ token }: { token: string }) {
  return <InvitePage view={useInvitePage(token)} />;
}
