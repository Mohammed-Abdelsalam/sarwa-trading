'use client';

import { TriangleAlert } from 'lucide-react';

import { Button, StateView } from '@sarwa/ui';

import { useCopy } from '../lib/i18n';

export default function Error({ retry }: { error: Error; retry: () => void }) {
  const { t } = useCopy();
  return (
    <StateView
      className="py-24"
      tone="neg"
      icon={<TriangleAlert />}
      title={t.errorPage.title}
      description={t.errorPage.body}
      action={
        <Button
          onClick={() => {
            retry();
          }}
        >
          {t.errorPage.retry}
        </Button>
      }
    />
  );
}
