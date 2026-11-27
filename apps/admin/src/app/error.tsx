'use client';

import { TriangleAlert } from 'lucide-react';

import { useAdminI18n } from '@sarwa/core/admin';
import { Button, StateView } from '@sarwa/ui';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  const { t } = useAdminI18n();
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
