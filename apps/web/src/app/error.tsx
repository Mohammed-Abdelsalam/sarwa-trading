'use client';

import { TriangleAlert } from 'lucide-react';

import { Button, StateView } from '@sarwa/ui';

import { useCopy } from '../lib/i18n';

export default function Error({ retry }: { error: Error; retry: () => void }) {
  const { m } = useCopy();
  return (
    <StateView
      className="py-24"
      tone="neg"
      icon={<TriangleAlert />}
      title={m.errorPage.title}
      description={m.errorPage.body}
      action={
        <Button
          onClick={() => {
            retry();
          }}
        >
          {m.errorPage.retry}
        </Button>
      }
    />
  );
}
