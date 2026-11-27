'use client';

import { CircleCheck, PartyPopper, RotateCcw } from 'lucide-react';

import { type GuestDataCounts } from '@sarwa/contracts';
import { POLICY } from '@sarwa/core';
import { Button, Toast } from '@sarwa/ui';

import { useToast } from '../../components/layout/toast-host';
import { useCopy } from '../../lib/i18n';

interface Dismiss {
  onDismiss: () => void;
}

// Right after sign-up; the Home variant greets by name.
export function ReadyToast({
  name,
  onTrade,
  onDismiss,
}: Dismiss & { name?: string; onTrade: () => void }) {
  const { t, f } = useCopy();
  return (
    <Toast
      icon={<PartyPopper aria-hidden className="text-brand-fg" />}
      title={t.toasts.readyTitle({ amount: f.money(POLICY.startingCashCents, { whole: true }) })}
      description={name ? t.toasts.readyBodyHome({ name }) : t.toasts.readyBody}
      action={
        <Button variant="ghost" size="sm" onClick={onTrade}>
          {t.toasts.trade}
        </Button>
      }
      onDismiss={onDismiss}
      dismissLabel={t.common.dismiss}
    />
  );
}

// Sign-up kept this device's guest portfolio.
export function ClaimedToast({ counts, onDismiss }: Dismiss & { counts: GuestDataCounts }) {
  const { t, f } = useCopy();
  return (
    <Toast
      icon={<CircleCheck aria-hidden className="text-pos" />}
      title={t.toasts.claimedTitle}
      description={t.toasts.claimedBody({
        positions: t.counts.positions(f.count(counts.positions)),
        orders: t.counts.openOrders(f.count(counts.openOrders)),
      })}
      onDismiss={onDismiss}
      dismissLabel={t.common.dismiss}
    />
  );
}

// Signing in during the 7-day grace canceled a requested deletion.
export function DeletionCanceledToast({ onDismiss }: Dismiss) {
  const { t } = useCopy();
  return (
    <Toast
      icon={<RotateCcw aria-hidden className="text-brand-fg" />}
      title={t.toasts.deletionCanceledTitle}
      description={t.toasts.deletionCanceledBody}
      onDismiss={onDismiss}
      dismissLabel={t.common.dismiss}
    />
  );
}

// A settings form saved: "Profile saved", "Password updated".
export function useSavedToast(): (title: string) => void {
  const { t } = useCopy();
  const show = useToast();
  return (title) => {
    show((dismiss) => (
      <Toast
        icon={<CircleCheck aria-hidden className="text-pos" />}
        title={title}
        onDismiss={dismiss}
        dismissLabel={t.common.dismiss}
      />
    ));
  };
}
