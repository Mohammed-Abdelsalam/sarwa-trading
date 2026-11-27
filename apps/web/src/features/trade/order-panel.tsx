'use client';

import { Card, Drawer, Sheet } from '@sarwa/ui';

import { TicketEntry } from './ticket-entry';
import { TicketResult, TicketReview } from './ticket-review';
import { useOrderPanel } from './use-order-panel';

// ≥1280 a sticky side panel; 768–1279 a right drawer; below that a bottom sheet with a trade bar.
// The body is left out of the hidden panel while an overlay shows it, so it is never in the DOM twice.
export function OrderPanel({ symbol }: { symbol: string }) {
  const panel = useOrderPanel(symbol);
  const { labels, actions } = panel;
  const body =
    panel.step === 'entry' ? (
      <TicketEntry panel={panel} />
    ) : panel.step === 'review' ? (
      <TicketReview panel={panel} />
    ) : (
      <TicketResult panel={panel} />
    );

  const onOpenChange = (open: boolean) => {
    if (!open) actions.close();
  };
  return (
    <>
      {/* Rendered on the server for every width, so the side panel never pops in after hydration. */}
      <Card
        role="region"
        aria-label={labels.title}
        className="shadow-e2 sticky top-20 flex flex-col gap-3.5 p-4.5 max-xl:hidden"
      >
        {panel.overlayOpen ? null : body}
      </Card>
      <div className="border-border bg-surface fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 gap-2.5 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] xl:hidden">
        <button
          type="button"
          onClick={() => {
            actions.openTicket('buy');
          }}
          className="bg-brand text-on-brand type-button-lg rounded-control-lg focus-visible:outline-focus h-12 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {labels.buy}
        </button>
        <button
          type="button"
          onClick={() => {
            actions.openTicket('sell');
          }}
          className="bg-fg text-bg type-button-lg rounded-control-lg focus-visible:outline-focus h-12 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {labels.sell}
        </button>
      </div>
      {panel.overlay === 'drawer' ? (
        <Drawer
          open={panel.overlayOpen}
          onOpenChange={onOpenChange}
          title={labels.title}
          hideTitle
          closeLabel={labels.close}
          size="sm"
        >
          {body}
        </Drawer>
      ) : (
        <Sheet open={panel.overlayOpen} onOpenChange={onOpenChange} title={labels.title} hideTitle>
          {body}
        </Sheet>
      )}
    </>
  );
}
