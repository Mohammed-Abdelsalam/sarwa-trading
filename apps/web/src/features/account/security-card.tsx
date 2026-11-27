'use client';

import { KeyRound, Monitor, ShieldCheck, Smartphone, TriangleAlert } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { type SessionInfo } from '@sarwa/contracts';
import {
  Badge,
  Button,
  Callout,
  Card,
  Dialog,
  Field,
  PasswordInput,
  Skeleton,
  StateView,
} from '@sarwa/ui';

import { type Copy, useCopy } from '../../lib/i18n';
import { PasswordStrength, ProblemBanner } from '../auth/auth-parts';
import { fieldMessage } from '../auth/auth-view';
import { ProfileCard } from './profile-card';
import { SettingsLayout } from './settings-layout';
import {
  type ChangePasswordView,
  type SecurityPageView,
  type SessionsView,
} from './use-security-page';

const DAY_MS = 86_400_000;
// A session used this recently reads "Active now".
const ACTIVE_NOW_MS = 120_000;

export function sessionDevice({ t }: Copy, session: SessionInfo): string {
  const copy = t.account.sessions;
  if (session.platform === 'web' && session.browser && session.os)
    return copy.deviceWeb({ browser: session.browser, os: session.os });
  if (session.platform === 'ios' && session.model) return copy.deviceIos({ model: session.model });
  if (session.platform === 'android' && session.model)
    return copy.deviceAndroid({ model: session.model });
  return session.label;
}

function lastChanged({ t, f }: Copy, changedAt: number | null, now: number): string {
  const copy = t.account.password;
  if (changedAt === null) return copy.neverChanged;
  const days = Math.floor((now - changedAt) / DAY_MS);
  return days < 1 ? copy.changedToday : copy.lastChanged(f.count(days));
}

function ChangePasswordForm({ view }: { view: ChangePasswordView }) {
  const copy = useCopy();
  const { t, f } = copy;
  const { values, errors, actions } = view;
  const field = (
    key: 'current' | 'next' | 'confirm',
    label: string,
    autoComplete: string,
    onChange: (value: string) => void,
    extra: { error?: string; hint?: string } = {},
  ) => (
    <Field label={label} error={extra.error ?? fieldMessage(copy, errors[key])} hint={extra.hint}>
      {(props) => (
        <PasswordInput
          {...props}
          autoComplete={autoComplete}
          showLabel={t.auth.showPassword}
          hideLabel={t.auth.hidePassword}
          value={values[key]}
          disabled={view.isPending}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      )}
    </Field>
  );
  return (
    <form
      noValidate
      className="flex flex-col gap-3.5"
      onSubmit={(event) => {
        event.preventDefault();
        actions.submit();
      }}
    >
      {view.problem ? <ProblemBanner key={view.problem} problem={view.problem} /> : null}
      {field('current', t.account.password.current, 'current-password', actions.setCurrent, {
        error: view.currentIncorrect ? t.auth.errors.INVALID_CURRENT_PASSWORD : undefined,
      })}
      {field('next', t.account.password.new, 'new-password', actions.setNext, {
        hint: t.account.password.newHint({ n: f.number(view.password.minLength) }),
      })}
      <PasswordStrength check={view.password} tip={false} />
      {field('confirm', t.account.password.confirm, 'new-password', actions.setConfirm, {
        hint: view.matches ? t.auth.reset.match : undefined,
      })}
      <Callout tone="warn" icon={<TriangleAlert />}>
        {t.account.password.warn}
      </Callout>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={actions.cancel} disabled={view.isPending}>
          {t.common.cancel}
        </Button>
        <Button type="submit" loading={view.isPending}>
          {view.isPending ? t.account.password.loading : t.account.password.submit}
        </Button>
      </div>
    </form>
  );
}

function SessionRow({
  session,
  now,
  view,
}: {
  session: SessionInfo;
  now: number;
  view: SessionsView;
}) {
  const copy = useCopy();
  const { t, f } = copy;
  const device = sessionDevice(copy, session);
  const Icon = session.platform === 'web' ? Monitor : Smartphone;
  const active = session.current || now - session.lastActiveAt < ACTIVE_NOW_MS;
  return (
    <li className="border-border flex items-center gap-3 border-t py-3">
      <span
        aria-hidden
        className="bg-surface-3 text-fg-2 grid size-9 shrink-0 place-items-center rounded-md"
      >
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <span className="type-sm flex flex-wrap items-center gap-2 font-semibold">
          {device}
          {session.current ? <Badge tone="pos">{t.account.sessions.thisDevice}</Badge> : null}
        </span>
        <span className="type-caption text-fg-3 block">
          {t.account.sessions.meta({
            ip: session.ipMasked,
            time: active ? t.account.sessions.activeNow : f.relative(session.lastActiveAt, now),
          })}
        </span>
      </div>
      {session.current ? null : (
        <Button
          variant="secondary"
          size="sm"
          aria-label={t.account.sessions.signOutA11y({ device })}
          loading={view.revokingId === session.id}
          onClick={() => {
            view.actions.revoke(session.id);
          }}
        >
          {t.account.sessions.signOut}
        </Button>
      )}
    </li>
  );
}

function SignOutOthersDialog({ view, others }: { view: SessionsView; others: SessionInfo[] }) {
  const copy = useCopy();
  const { t, f, locale } = copy;
  const devices = new Intl.ListFormat(locale, { type: 'conjunction' }).format(
    others.map((session) => sessionDevice(copy, session)),
  );
  const count = f.count(others.length);
  return (
    <Dialog
      open={view.confirmOthers}
      onOpenChange={(open) => {
        if (!open) view.actions.cancelSignOutOthers();
      }}
      title={t.account.signOutOthers.title}
      description={t.account.signOutOthers.body({ sessions: t.counts.sessions(count), devices })}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={view.actions.cancelSignOutOthers}
            disabled={view.isRevokingOthers}
          >
            {t.common.cancel}
          </Button>
          <Button
            variant="danger"
            onClick={view.actions.confirmSignOutOthers}
            loading={view.isRevokingOthers}
          >
            {t.account.signOutOthers.confirm({ devices: t.counts.devices(count) })}
          </Button>
        </>
      }
    />
  );
}

function SessionsList({ view, now }: { view: SessionsView; now: number }) {
  const { t, f } = useCopy();
  const others = view.items.filter((session) => !session.current);
  if (view.status === 'error')
    return (
      <StateView
        tone="neg"
        icon={<TriangleAlert />}
        title={t.account.sessions.loadError}
        description={t.common.loadErrorBody}
        action={
          <Button variant="secondary" onClick={view.actions.retry}>
            {t.common.retry}
          </Button>
        }
      />
    );
  return (
    <section aria-labelledby="sessions-title" className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div>
          <h3 id="sessions-title" className="type-sm font-semibold">
            {t.account.sessions.title}
          </h3>
          {view.status === 'ready' ? (
            <p className="type-caption text-fg-3">
              {t.account.sessions.sub({ devices: t.counts.devices(f.count(view.items.length)) })}
            </p>
          ) : null}
        </div>
        {others.length > 0 ? (
          <Button variant="secondary" size="sm" onClick={view.actions.askSignOutOthers}>
            {t.account.sessions.signOutOthers}
          </Button>
        ) : null}
      </div>
      {view.status === 'loading' ? (
        <div className="flex flex-col gap-3" aria-busy>
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <ul>
          {view.items.map((session) => (
            <SessionRow key={session.id} session={session} now={now} view={view} />
          ))}
        </ul>
      )}
      <SignOutOthersDialog view={view} others={others} />
    </section>
  );
}

export function SecurityCard({ view }: { view: SecurityPageView }) {
  const copy = useCopy();
  const { t } = copy;
  const password = view.password;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(password.open);
  // Closing the inline form (cancel or saved) hands focus back to the button that opened it.
  useEffect(() => {
    if (wasOpen.current && !password.open) toggleRef.current?.focus();
    wasOpen.current = password.open;
  }, [password.open]);
  return (
    <Card className="flex flex-col gap-4 px-5 py-4.5">
      <h2 className="type-h3">{t.account.sections.security}</h2>
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <KeyRound aria-hidden className="text-fg-2 size-4.5" />
          <div className="min-w-0 flex-1">
            <b className="type-sm block">{t.account.password.title}</b>
            <span className="type-caption text-fg-3">
              {lastChanged(copy, view.profile.user.passwordChangedAt, view.now)}
            </span>
          </div>
          {password.open ? null : (
            <Button ref={toggleRef} variant="secondary" size="sm" onClick={password.actions.open}>
              {t.account.password.change}
            </Button>
          )}
        </div>
        {password.open ? <ChangePasswordForm view={password} /> : null}
      </div>
      <SessionsList view={view.sessions} now={view.now} />
      <div className="border-border flex items-center gap-3 border-t pt-3.5">
        <ShieldCheck aria-hidden className="text-fg-2 size-4.5" />
        <div className="min-w-0 flex-1">
          <b className="type-sm block">{t.account.twoFactor.title}</b>
          <span className="type-caption text-fg-3">{t.account.twoFactor.sub}</span>
        </div>
        <Badge tone="neutral">{t.account.twoFactor.soon}</Badge>
      </div>
    </Card>
  );
}

export function SecuritySettingsPage({ view }: { view: SecurityPageView }) {
  return (
    <SettingsLayout section="security">
      <ProfileCard view={view.profile} />
      <SecurityCard view={view} />
    </SettingsLayout>
  );
}
