'use client';

import { type GuestDataCounts } from '@sarwa/contracts';
import { Button, Dialog } from '@sarwa/ui';

import { useCopy } from '../../lib/i18n';

// Signing in over a device's guest portfolio replaces it; the two are never merged.
export function DiscardDialog({
  counts,
  isPending,
  onConfirm,
  onCancel,
}: {
  counts: GuestDataCounts | null;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t, f } = useCopy();
  return (
    <Dialog
      open={counts !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title={t.discard.title}
      description={
        counts
          ? t.discard.body({
              positions: t.counts.positions(f.count(counts.positions)),
              orders: t.counts.openOrders(f.count(counts.openOrders)),
            })
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={isPending}>
            {t.discard.cancel}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={isPending}>
            {t.discard.confirm}
          </Button>
        </>
      }
    />
  );
}
