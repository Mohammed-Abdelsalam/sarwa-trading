'use client';

import { TriangleAlert } from 'lucide-react';

import { useI18n } from '@sarwa/core';
import { Button, StateView } from '@sarwa/ui';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n();
  return (
    <StateView
      className="py-24"
      tone="neg"
      icon={<TriangleAlert />}
      title={t.admin.states.crashed}
      description={t.admin.states.crashedBody}
      action={<Button onClick={reset}>{t.admin.states.tryAgain}</Button>}
    />
  );
}
