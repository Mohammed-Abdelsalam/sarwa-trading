'use client';

import { Eye, EyeOff, ShieldCheck, TriangleAlert } from 'lucide-react';

import { PASSWORD_MIN_LENGTH, REMEMBER_DAYS, useAdminI18n } from '@sarwa/core/admin';
import { Badge, Button, Callout, Card, Field, IconButton, Input, Logo } from '@sarwa/ui';

import { TickerRows } from '../../components/common/ticker';
import { useLoginPage } from './use-login-page';

export function LoginPage() {
  const page = useLoginPage();
  const { t, f, dir } = useAdminI18n();
  const copy = t.admin.login;
  const fieldError = (code: 'emailInvalid' | 'passwordShort') =>
    code === 'emailInvalid'
      ? copy.emailInvalid
      : copy.passwordShort({ n: f.number(PASSWORD_MIN_LENGTH) });
  const invalid = page.error === 'invalid';
  const blocked = page.error === 'cooldown';

  return (
    <div dir={dir} className="bg-bg grid min-h-dvh lg:grid-cols-[35rem_minmax(0,1fr)]">
      <aside className="border-border bg-surface hidden flex-col justify-between border-e px-12 py-10 lg:flex">
        <span className="flex items-center gap-2.5">
          <Logo />
          <Badge tone="brand">{t.admin.shell.admin}</Badge>
        </span>
        <div className="flex flex-col gap-5">
          <h2 className="type-h1 text-fg text-[2.125rem] leading-[2.625rem]">
            {copy.heroTitle}
            <br />
            {copy.heroTitle2}
          </h2>
          <p className="type-body text-fg-2">{copy.heroBody}</p>
          <Card className="overflow-hidden" aria-hidden>
            <TickerRows rows={page.ticker} isLoading={page.tickerLoading} sparkline />
          </Card>
        </div>
        <span className="type-caption text-fg-3">
          {copy.footer({ year: String(new Date().getFullYear()) })}
        </span>
      </aside>
      <main className="grid place-items-center p-10">
        <form
          noValidate
          aria-labelledby="login-title"
          className="flex w-full max-w-100 flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            page.actions.submit();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <h1 id="login-title" className="type-h1 text-fg">
              {copy.title}
            </h1>
            <p className="type-sm text-fg-2">{copy.subtitle}</p>
          </div>
          {invalid ? (
            <Callout tone="neg" icon={<TriangleAlert />} urgent title={copy.invalidTitle}>
              <span className="text-fg-2">
                {copy.attemptsLeft({ n: f.number(page.attemptsLeft) })}
              </span>
            </Callout>
          ) : null}
          {blocked ? (
            <Callout tone="warn" icon={<TriangleAlert />} urgent title={copy.cooldownTitle}>
              <span className="text-fg-2 tabular-nums">
                {copy.cooldown({ n: f.number(page.cooldownSeconds) })}
              </span>
            </Callout>
          ) : null}
          {page.error === 'unavailable' ? (
            <Callout tone="neg" icon={<TriangleAlert />} urgent>
              {copy.unavailable}
            </Callout>
          ) : null}
          <Field
            label={copy.email}
            error={page.errors.email ? fieldError(page.errors.email) : undefined}
          >
            {(field) => (
              <Input
                {...field}
                aria-invalid={field['aria-invalid'] || invalid}
                inputSize="lg"
                type="email"
                autoComplete="username"
                placeholder={copy.emailPlaceholder}
                value={page.email}
                disabled={page.isPending}
                onChange={(event) => {
                  page.actions.setEmail(event.target.value);
                }}
              />
            )}
          </Field>
          <Field
            label={copy.password}
            error={
              page.errors.password
                ? fieldError(page.errors.password)
                : invalid
                  ? copy.fieldError
                  : undefined
            }
          >
            {(field) => (
              <div className="relative">
                <Input
                  {...field}
                  inputSize="lg"
                  type={page.showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pe-12"
                  value={page.password}
                  disabled={page.isPending}
                  onChange={(event) => {
                    page.actions.setPassword(event.target.value);
                  }}
                />
                <IconButton
                  size={32}
                  label={page.showPassword ? copy.hidePassword : copy.showPassword}
                  className="absolute end-1.5 top-1/2 -translate-y-1/2"
                  disabled={page.isPending}
                  onClick={page.actions.toggleShowPassword}
                >
                  {page.showPassword ? (
                    <EyeOff aria-hidden className="size-4" />
                  ) : (
                    <Eye aria-hidden className="size-4" />
                  )}
                </IconButton>
              </div>
            )}
          </Field>
          <label className="type-sm text-fg-2 flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              className="accent-brand size-4.5"
              checked={page.remember}
              disabled={page.isPending}
              onChange={(event) => {
                page.actions.setRemember(event.target.checked);
              }}
            />
            {copy.remember({ n: f.number(REMEMBER_DAYS) })}
          </label>
          <Button
            type="submit"
            size="lg"
            loading={page.isPending}
            disabled={blocked || page.isPending}
          >
            {page.isPending ? copy.submitting : copy.submit}
          </Button>
          <p className="type-caption text-fg-3 flex items-center justify-center gap-2">
            <ShieldCheck aria-hidden className="size-3.5" />
            {copy.security}
          </p>
        </form>
      </main>
    </div>
  );
}
