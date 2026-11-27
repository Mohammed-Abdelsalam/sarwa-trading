import { CircleAlert, Clock } from 'lucide-react';
import { useId } from 'react';

import {
  Button,
  Callout,
  Chip,
  cn,
  EstimateRows,
  Field,
  Input,
  Kbd,
  SegmentedControl,
  Select,
  SideToggle,
} from '@sarwa/ui';

import { type OrderPanelModel } from './use-order-panel';

const TYPES = ['market', 'limit', 'stop'] as const;

export function TicketEntry({ panel }: { panel: OrderPanelModel }) {
  const { entry, labels, actions } = panel;
  const tifId = useId();

  return (
    <form
      className="flex flex-col gap-3.5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        actions.review();
      }}
    >
      <SideToggle
        label={labels.side}
        value={entry.side}
        onChange={actions.setSide}
        buyLabel={labels.buy}
        sellLabel={labels.sell}
        {...(entry.sellSuffix ? { sellSuffix: entry.sellSuffix } : {})}
      />

      <div role="radiogroup" aria-label={labels.orderType} className="flex gap-2">
        {TYPES.map((type) => (
          <Chip
            key={type}
            role="radio"
            aria-checked={entry.type === type}
            active={entry.type === type}
            className="h-8.5"
            onClick={() => {
              actions.setType(type);
            }}
          >
            {labels.types[type]}
          </Chip>
        ))}
      </div>
      {entry.typeHint ? <p className="type-caption text-fg-3 -mt-1.5">{entry.typeHint}</p> : null}

      {entry.price ? (
        <Field label={entry.price.label} hint={entry.price.hint} error={entry.price.error}>
          {(field) => (
            <Input
              {...field}
              inputSize="lg"
              inputMode="decimal"
              autoComplete="off"
              prefix={entry.currency}
              className="tabular-nums"
              value={entry.price?.value ?? ''}
              onChange={(event) => {
                actions.setPrice(event.target.value);
              }}
            />
          )}
        </Field>
      ) : null}

      <Field label={labels.quantity} hint={entry.size.hint} error={entry.size.error}>
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <SegmentedControl
              label={labels.sizeMode}
              className="self-end"
              value={entry.sizeMode}
              onChange={actions.setSizeMode}
              options={[
                { value: 'amount', label: labels.amount },
                { value: 'shares', label: labels.shares },
              ]}
            />
            <Input
              {...field}
              inputSize="lg"
              inputMode="decimal"
              autoComplete="off"
              className="tabular-nums"
              {...(entry.sizeMode === 'amount' ? { prefix: entry.currency } : {})}
              value={entry.size.value}
              onChange={(event) => {
                actions.setSize(event.target.value);
              }}
            />
          </div>
        )}
      </Field>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={tifId} className="type-sm text-fg font-semibold">
          {labels.timeInForce}
        </label>
        <Select
          id={tifId}
          value={entry.type === 'market' ? 'day' : entry.tif}
          disabled={entry.type === 'market'}
          onChange={(event) => {
            actions.setTif(event.target.value === 'gtc' ? 'gtc' : 'day');
          }}
        >
          <option value="day">{labels.tif.day}</option>
          <option value="gtc">{labels.tif.gtc}</option>
        </Select>
      </div>

      <EstimateRows rows={entry.estimate.rows} total={entry.estimate.total} />

      {entry.gate ? (
        <Callout tone="warn" icon={<CircleAlert />} title={entry.gate.title}>
          {entry.gate.body}
        </Callout>
      ) : null}
      {entry.marketClosed ? (
        <Callout tone="info" icon={<Clock />} title={entry.marketClosed.title}>
          {entry.marketClosed.body}
        </Callout>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={!entry.canReview}>
        <span className={cn('truncate')}>{entry.reviewLabel}</span>
        {entry.canReview ? <Kbd variant="inverse">{labels.enterKey}</Kbd> : null}
      </Button>
      <p className="type-caption text-fg-3 text-center">{labels.disclosure}</p>
    </form>
  );
}
