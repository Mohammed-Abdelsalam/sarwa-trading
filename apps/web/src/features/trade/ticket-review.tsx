import { ChevronLeft, CircleCheck, Info, TriangleAlert } from 'lucide-react';

import { Button, Callout, Card, CountdownBar, EstimateRows, IconButton, Kbd } from '@sarwa/ui';

import { type OrderPanelModel } from './use-order-panel';

export function TicketReview({ panel }: { panel: OrderPanelModel }) {
  const { review, actions } = panel;
  if (!review) return null;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2">
        <IconButton
          label={review.editA11y}
          size={32}
          onClick={actions.edit}
          disabled={review.sending}
        >
          <ChevronLeft aria-hidden className="size-4 rtl:-scale-x-100" />
        </IconButton>
        <h2 className="type-h3">{review.heading}</h2>
      </div>
      <div>
        <p className="type-h2">{review.title}</p>
        <p className="type-sm text-fg-2">{review.subtitle}</p>
      </div>
      <Card className="px-3.5 py-1.5 shadow-none">
        <EstimateRows rows={review.rows} total={review.total} />
      </Card>
      {review.countdown ? (
        <div className="flex flex-col gap-1.5">
          <CountdownBar
            remaining={review.countdown.remaining}
            label={review.countdown.label}
            valueText={review.countdown.text}
          />
          <span className="type-caption text-fg-3">{review.countdown.text}</span>
        </div>
      ) : null}
      {review.resting ? (
        <Callout tone="info" icon={<Info />}>
          {review.resting}
        </Callout>
      ) : null}
      {review.largeOrder ? (
        <Callout tone="warn" icon={<TriangleAlert />} title={review.largeOrder.title}>
          {review.largeOrder.body}
        </Callout>
      ) : null}
      {review.error ? (
        <Callout
          tone="neg"
          urgent
          icon={<TriangleAlert />}
          title={review.error.title}
          action={
            <Button size="sm" variant="secondary" onClick={actions.retry}>
              {review.error.retry}
            </Button>
          }
        >
          {review.error.body}
        </Callout>
      ) : null}
      <Button size="lg" className="w-full" loading={review.sending} onClick={actions.submit}>
        {review.placeLabel}
        {review.sending ? null : <Kbd variant="inverse">{review.placeShortcut}</Kbd>}
      </Button>
      <Button variant="ghost" className="w-full" onClick={actions.edit} disabled={review.sending}>
        {review.edit}
      </Button>
    </div>
  );
}

const RESULT_ICON = { pos: CircleCheck, brand: Info, info: Info, neg: TriangleAlert } as const;
const RESULT_TONE = {
  pos: 'text-pos',
  brand: 'text-brand-fg',
  info: 'text-info',
  neg: 'text-neg',
} as const;

export function TicketResult({ panel }: { panel: OrderPanelModel }) {
  const { result, labels, actions } = panel;
  if (!result) return null;
  const Icon = RESULT_ICON[result.tone];

  return (
    <div className="flex flex-col gap-3.5" role="status">
      <div className="flex items-center gap-2.5">
        <Icon aria-hidden className={`size-6 ${RESULT_TONE[result.tone]}`} />
        <h2 className="type-h2">{result.title}</h2>
      </div>
      <p className="type-body text-fg-2">{result.body}</p>
      <Card className="px-3.5 py-1.5 shadow-none">
        <EstimateRows rows={result.rows} />
      </Card>
      {result.position.length > 0 ? (
        <Card className="px-3.5 py-1.5 shadow-none">
          <EstimateRows rows={result.position} />
        </Card>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={actions.viewPosition}>
          {labels.viewPosition}
        </Button>
        <Button variant="secondary" onClick={actions.setAlert}>
          {labels.setAlert}
        </Button>
      </div>
      <Button className="w-full" onClick={actions.done}>
        {labels.done}
      </Button>
    </div>
  );
}
