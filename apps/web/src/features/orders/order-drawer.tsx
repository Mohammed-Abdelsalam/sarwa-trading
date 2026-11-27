import { Info, RefreshCw, TriangleAlert } from 'lucide-react';

import {
  Button,
  Callout,
  Card,
  Drawer,
  EstimateRows,
  Field,
  Input,
  ProgressBar,
  Skeleton,
  StatusBadge,
  StockAvatar,
  Timeline,
} from '@sarwa/ui';

import { useOrderDrawer } from './use-order-drawer';

const TONE = { up: 'text-pos', down: 'text-neg', flat: 'text-fg-2' } as const;
const NOTICE_ICON = { info: <Info />, neutral: <Info />, neg: <TriangleAlert /> } as const;

export function OrderDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const drawer = useOrderDrawer(id);
  const { order, labels, actions } = drawer;

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={order?.title ?? labels.title}
      hideTitle
      closeLabel={labels.close}
      header={<span className="type-mono text-fg-3 text-xs">{id}</span>}
      footer={
        order && !drawer.editing && (order.modifiable || order.cancellable) ? (
          <>
            {order.modifiable ? (
              <Button variant="secondary" onClick={actions.startEdit}>
                {labels.modify}
              </Button>
            ) : null}
            {order.cancellable ? (
              <Button variant="danger" loading={drawer.cancelling} onClick={actions.cancel}>
                {labels.cancelRemaining}
              </Button>
            ) : null}
          </>
        ) : undefined
      }
    >
      {drawer.isError ? (
        <Callout
          tone="neg"
          icon={<TriangleAlert />}
          title={labels.loadError}
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={<RefreshCw className="size-4" />}
              onClick={actions.retry}
            >
              {labels.retry}
            </Button>
          }
        />
      ) : !order ? (
        <Skeleton className="h-60" />
      ) : (
        <>
          <div className="flex items-center gap-3">
            <StockAvatar symbol={order.symbol} sector={order.sector} size={40} />
            <div className="min-w-0 flex-1">
              <p className="type-h2" aria-hidden>
                {order.title}
              </p>
              <p className="type-sm text-fg-2">{order.subtitle}</p>
            </div>
            <StatusBadge status={order.status} label={order.statusLabel} />
          </div>

          {order.progress ? (
            <div className="flex flex-col gap-2">
              <div className="type-sm text-fg-2 flex justify-between tabular-nums">
                <span>{order.progress.text}</span>
                {order.avg ? <span>{order.avg}</span> : null}
              </div>
              <ProgressBar
                value={order.progress.value}
                label={order.progress.a11y}
                valueText={order.progress.a11y}
              />
            </div>
          ) : null}

          <Timeline steps={order.timeline} />

          <Card className="px-3.5 py-1.5 shadow-none">
            <EstimateRows
              rows={[
                order.soFar,
                ...(order.realized
                  ? [
                      {
                        label: order.realized.label,
                        value: (
                          <span className={TONE[order.realized.direction]}>
                            {order.realized.value}
                          </span>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </Card>

          {drawer.notice ? (
            <Callout
              tone={drawer.notice.tone}
              icon={NOTICE_ICON[drawer.notice.tone]}
              title={drawer.notice.title}
            >
              {drawer.notice.body || null}
            </Callout>
          ) : null}

          {drawer.editing ? (
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                actions.save();
              }}
            >
              {order.editPrice ? (
                <Field label={labels.newPrice} error={drawer.editError}>
                  {(field) => (
                    <Input
                      {...field}
                      prefix={drawer.currency}
                      inputMode="decimal"
                      value={drawer.priceText}
                      onChange={(event) => {
                        actions.setPriceText(event.target.value);
                      }}
                    />
                  )}
                </Field>
              ) : null}
              {order.editQty ? (
                <Field
                  label={labels.newQuantity}
                  error={order.editPrice ? undefined : drawer.editError}
                >
                  {(field) => (
                    <Input
                      {...field}
                      inputMode="decimal"
                      value={drawer.qtyText}
                      onChange={(event) => {
                        actions.setQtyText(event.target.value);
                      }}
                    />
                  )}
                </Field>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="ghost" onClick={actions.stopEdit}>
                  {labels.discard}
                </Button>
                <Button type="submit" loading={drawer.saving}>
                  {labels.save}
                </Button>
              </div>
            </form>
          ) : null}
        </>
      )}
    </Drawer>
  );
}
