import { useId } from 'react';

import { Button, Dialog, Field, Input, SegmentedControl, Select, StockAvatar } from '@sarwa/ui';

import { type AlertCondition, type AlertRepeat, useAlertDialog } from './use-alert-dialog';

const CONDITIONS: readonly AlertCondition[] = ['price_above', 'price_below', 'move_today'];
export function AlertDialog({
  initialSymbol,
  onClose,
}: {
  initialSymbol: string | null;
  onClose: () => void;
}) {
  const dialog = useAlertDialog({ initialSymbol, onClose });
  const { labels, actions } = dialog;
  const stockId = useId();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={labels.title}
      description={dialog.now ?? undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {labels.cancel}
          </Button>
          <Button
            type="submit"
            form={`${stockId}-form`}
            loading={dialog.sending}
            disabled={!dialog.symbol}
          >
            {labels.create}
          </Button>
        </>
      }
    >
      <form
        id={`${stockId}-form`}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          actions.submit();
        }}
      >
        <div className="flex items-center gap-3">
          {dialog.stock ? (
            <StockAvatar symbol={dialog.stock.symbol} sector={dialog.stock.sector} />
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor={stockId} className="type-sm font-semibold">
              {labels.stock}
            </label>
            <Select
              id={stockId}
              value={dialog.symbol}
              onChange={(event) => {
                actions.setSymbol(event.target.value);
              }}
            >
              <option value="" disabled>
                {labels.chooseStock}
              </option>
              {dialog.symbols.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <SegmentedControl
          label={labels.condition}
          className="w-full [&>button]:flex-1"
          value={dialog.condition}
          onChange={actions.setCondition}
          options={CONDITIONS.map((value) => ({ value, label: labels.conditions[value] }))}
        />
        <Field label={labels.target} hint={dialog.hint} error={dialog.error}>
          {(field) => (
            <Input
              {...field}
              inputSize="lg"
              inputMode="decimal"
              autoComplete="off"
              className="tabular-nums"
              {...(dialog.condition === 'move_today'
                ? { suffix: '%' }
                : { prefix: dialog.currency })}
              value={dialog.target}
              onChange={(event) => {
                actions.setTarget(event.target.value);
              }}
            />
          )}
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="type-sm">{labels.repeat}</span>
          <SegmentedControl<AlertRepeat>
            label={labels.repeat}
            value={dialog.repeat}
            onChange={actions.setRepeat}
            options={[
              { value: 'once', label: labels.once },
              { value: 'every', label: labels.every },
            ]}
          />
        </div>
      </form>
    </Dialog>
  );
}
