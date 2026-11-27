import { ArrowLeft, Eye, Lock } from 'lucide-react';
import Link from 'next/link';
import {
  cloneElement,
  type ComponentProps,
  type ReactElement,
  type SyntheticEvent,
  useId,
} from 'react';

import { type AdminUser } from '@sarwa/contracts';
import { useI18n } from '@sarwa/core';
import { Badge, Button, buttonVariants, Callout, cn, Switch, Tooltip } from '@sarwa/ui';

import { RoleBadge } from './identity';

export function ViewerNotice() {
  const { t } = useI18n();
  return (
    <Callout tone="info" icon={<Eye />} role="status">
      <b>{t.admin.viewer.title}</b> {t.admin.viewer.body}
    </Callout>
  );
}

export function ReadOnlyBadge() {
  const { t } = useI18n();
  return (
    <Badge tone="outline">
      <Lock aria-hidden className="size-3.5" />
      {t.admin.viewer.readOnly}
    </Badge>
  );
}

const block = (event: SyntheticEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

// Viewers keep every control in place and focusable, but inert and described as view-only, so layouts match between roles.
export function Locked({
  locked,
  children,
}: {
  locked: boolean;
  children: ReactElement<Record<string, unknown>>;
}) {
  const { t } = useI18n();
  const id = useId();
  if (!locked) return children;
  return (
    <Tooltip content={t.admin.viewer.locked}>
      <span
        className="inline-flex cursor-not-allowed"
        onClickCapture={block}
        onPointerDownCapture={block}
        onKeyDownCapture={(event) => {
          if (event.key !== 'Tab') block(event);
        }}
      >
        {cloneElement(children, { 'aria-disabled': true, 'aria-describedby': id })}
        <span id={id} className="sr-only">
          {t.admin.viewer.locked}
        </span>
      </span>
    </Tooltip>
  );
}

export function GuardedButton({
  locked,
  icon,
  disabled,
  ...props
}: ComponentProps<typeof Button> & { locked: boolean }) {
  return (
    <Locked locked={locked}>
      <Button
        {...props}
        disabled={!locked && disabled}
        icon={locked ? <Lock aria-hidden className="size-4" /> : icon}
      />
    </Locked>
  );
}

export function GuardedSwitch({
  locked,
  disabled,
  ...props
}: ComponentProps<typeof Switch> & { locked: boolean }) {
  return (
    <Locked locked={locked}>
      <Switch {...props} disabled={!locked && disabled} />
    </Locked>
  );
}

const FORBIDDEN_STATUS = 403;

export function Forbidden({ page, user }: { page: string; user: AdminUser | null }) {
  const { t, f } = useI18n();
  return (
    <div className="grid flex-1 place-items-center">
      <div className="flex max-w-115 flex-col items-center gap-4 text-center">
        <div aria-hidden className="relative size-30">
          <div className="bg-neg-subtle absolute inset-0 rounded-[36px]" />
          <div className="border-border bg-surface shadow-e2 text-neg absolute inset-6.5 grid place-items-center rounded-[22px] border">
            <Lock className="size-8" />
          </div>
        </div>
        <span className="type-mono text-fg-3 text-sm tracking-[0.1em]">
          {t.admin.forbidden.code({ n: f.number(FORBIDDEN_STATUS) })}
        </span>
        <h1 className="type-h1 text-fg">{t.admin.forbidden.title({ page })}</h1>
        <p className="type-body text-fg-2">
          {t.admin.forbidden.before} <b className="text-fg">{user?.email}</b>{' '}
          {t.admin.forbidden.middle}{' '}
          {user ? <RoleBadge role={user.role} className="align-middle" /> : null}{' '}
          {t.admin.forbidden.after}
        </p>
        <Link href="/overview" className={cn(buttonVariants({ size: 'lg' }), 'mt-1.5')}>
          <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
          {t.admin.forbidden.back}
        </Link>
      </div>
    </div>
  );
}
