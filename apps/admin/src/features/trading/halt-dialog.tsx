import { Pause, TriangleAlert } from 'lucide-react';

import { HALT_DURATIONS, type HaltDuration } from '@sarwa/contracts';
import { type AdminI18n, haltDurationLabel, useAdminI18n } from '@sarwa/core/admin';
import { Button, Callout, Dialog, Field, Input, SegmentedControl, Select } from '@sarwa/ui';

import { type HaltDialogModel } from './use-trading-page';

export function haltConfirmLabel(copy: AdminI18n, symbol: string, duration: HaltDuration): string {
  if (duration === 'until_close') return copy.t.admin.haltConfirmUntilClose({ symbol });
  if (duration === 'manual') return copy.t.admin.trading.haltManual({ symbol });
  return copy.t.admin.haltConfirm({ symbol, duration: haltDurationLabel(duration, copy) });
}

export function HaltDialog({ halt }: { halt: HaltDialogModel }) {
  const copy = useAdminI18n();
  const { t, f } = copy;
  const symbol = halt.symbol || '—';

  return (
    <Dialog
      open={halt.open}
      onOpenChange={(open) => {
        if (!open) halt.actions.close();
      }}
      title={t.admin.haltSymbol}
      description={t.admin.haltBody}
      className="max-w-125"
      footer={
        <>
          <Button variant="ghost" onClick={halt.actions.close}>
            {t.common.cancel}
          </Button>
          <Button
            variant="danger"
            icon={<Pause aria-hidden className="size-4" />}
            loading={halt.isSaving}
            disabled={!halt.symbol}
            onClick={halt.actions.submit}
          >
            {haltConfirmLabel(copy, symbol, halt.duration)}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          halt.actions.submit();
        }}
      >
        <Field label={t.admin.trading.symbol}>
          {(field) => (
            <Select
              {...field}
              value={halt.symbol}
              onChange={(event) => {
                halt.actions.setSymbol(event.target.value);
              }}
            >
              <option value="" disabled>
                {t.admin.trading.chooseSymbol}
              </option>
              {halt.stocks.map((stock) => (
                <option key={stock.symbol} value={stock.symbol}>
                  {stock.symbol} · {stock.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label={t.admin.haltReasonLabel}
          error={halt.messageError ? t.admin.trading.reasonRequired : undefined}
          hint={t.admin.haltUsersSee({ symbol, reason: halt.message.trim() || '…' })}
        >
          {(field) => (
            <Input
              {...field}
              maxLength={80}
              value={halt.message}
              onChange={(event) => {
                halt.actions.setMessage(event.target.value);
              }}
            />
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="type-sm text-fg font-semibold">{t.admin.haltDuration}</span>
          <SegmentedControl
            label={t.admin.haltDuration}
            className="grid grid-cols-4"
            options={HALT_DURATIONS.map((value) => ({
              value,
              label: haltDurationLabel(value, copy),
            }))}
            value={halt.duration}
            onChange={halt.actions.setDuration}
          />
        </div>
        <label className="type-sm text-fg flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            className="accent-brand size-4.5"
            checked={halt.notify}
            onChange={(event) => {
              halt.actions.setNotify(event.target.checked);
            }}
          />
          {t.admin.haltNotify(f.count(halt.impact?.holdersAndWatchers ?? 0))}
        </label>
        {halt.impact ? (
          <Callout tone="warn" icon={<TriangleAlert />} role="status">
            {t.admin.haltOpenOrders({ ...f.count(halt.impact.openOrders), symbol })}
          </Callout>
        ) : halt.impactLoading ? (
          <p className="type-caption text-fg-3" role="status">
            {t.admin.trading.checkingImpact}
          </p>
        ) : null}
        {halt.failed ? (
          <Callout tone="neg" urgent>
            {t.admin.states.actionFailed}
          </Callout>
        ) : null}
      </form>
    </Dialog>
  );
}
