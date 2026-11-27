'use client';

import { TriangleAlert } from 'lucide-react';

import { Button, StateView } from '@sarwa/ui';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <StateView
      className="py-24"
      tone="neg"
      icon={<TriangleAlert />}
      title="Something went wrong"
      description="The page hit an unexpected error. Your watchlist is safe."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
