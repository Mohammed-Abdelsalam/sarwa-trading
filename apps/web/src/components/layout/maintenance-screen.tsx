import { Clock, RefreshCw, Wrench } from 'lucide-react';

import { useRefreshAppConfig } from '@sarwa/core';
import { Button, Logo } from '@sarwa/ui';

const RETRY_MS = 30_000;

// Illustration geometry copied from the canvas (W-Global maintenance).
function MaintenanceArt() {
  return (
    <div aria-hidden className="relative mb-3 size-37">
      <div className="bg-brand-subtle absolute inset-0 rounded-[44px]" />
      <div className="bg-brand text-on-brand shadow-e2 absolute inset-7.5 grid place-items-center rounded-[28px]">
        <Wrench className="size-8" />
      </div>
      <div className="border-border bg-surface text-warn absolute top-2 -right-2 grid size-9.5 place-items-center rounded-full border">
        <Clock className="size-4" />
      </div>
    </div>
  );
}

export function MaintenanceScreen() {
  const checkAgain = useRefreshAppConfig({ every: RETRY_MS });
  return (
    <main className="relative grid min-h-dvh place-items-center p-10">
      <Logo className="absolute top-7 left-8" />
      <div className="flex max-w-130 flex-col items-center gap-4.5 text-center">
        <MaintenanceArt />
        <h1 className="type-h1 text-4xl">We&apos;ll be right back</h1>
        <p className="type-body text-fg-2 text-lg">
          Mini Trading is getting a scheduled upgrade. Your watchlist is saved and live prices
          return as soon as we&apos;re done.
        </p>
        <Button size="lg" icon={<RefreshCw aria-hidden className="size-4" />} onClick={checkAgain}>
          Check again
        </Button>
        <span className="type-caption text-fg-3">Retrying automatically every 30 s</span>
      </div>
    </main>
  );
}
