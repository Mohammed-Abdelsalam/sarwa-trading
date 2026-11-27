import { TriangleAlert } from 'lucide-react';

import { EXCHANGES, SECTORS } from '@sarwa/contracts';
import { type StockDraft, stockErrorText, useAdminI18n, volatilityRange } from '@sarwa/core/admin';
import { Button, Callout, Dialog, Field, Input, Select, Switch } from '@sarwa/ui';

import { type StockDialogModel } from './use-stocks-page';

type TextKey = 'symbol' | 'name' | 'basePrice' | 'volatility' | 'peRatio';

export function StockDialog({ dialog }: { dialog: StockDialogModel }) {
  const { t, f } = useAdminI18n();
  const copy = t.admin.stocks;
  const errorOf = (key: keyof StockDraft) => {
    const code = dialog.errors[key];
    return code ? stockErrorText(code, { t, f }) : undefined;
  };
  const text = (key: TextKey, extra: Parameters<typeof Input>[0] = {}) => (
    <Field
      label={copy.fields[key]}
      error={errorOf(key)}
      hint={key === 'volatility' ? copy.volatilityHint(volatilityRange({ f })) : undefined}
    >
      {(field) => (
        <Input
          {...field}
          {...extra}
          value={dialog.draft[key]}
          onChange={(event) => {
            dialog.actions.set(key, event.target.value);
          }}
        />
      )}
    </Field>
  );

  return (
    <Dialog
      open={dialog.open}
      onOpenChange={(open) => {
        if (!open) dialog.actions.close();
      }}
      title={dialog.editing ? copy.editTitle({ symbol: dialog.editing }) : copy.addTitle}
      description={copy.addBody}
      className="max-w-140"
      footer={
        <>
          <Button variant="ghost" onClick={dialog.actions.close}>
            {t.common.cancel}
          </Button>
          <Button type="submit" form="stock-form" loading={dialog.isSaving}>
            {dialog.editing ? copy.saveChanges : copy.add}
          </Button>
        </>
      }
    >
      <form
        id="stock-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          dialog.actions.submit();
        }}
      >
        {dialog.errorCount > 0 ? (
          <Callout tone="neg" icon={<TriangleAlert />} urgent>
            <b>{copy.fixFields({ n: f.number(dialog.errorCount) })}</b>
          </Callout>
        ) : null}
        {dialog.failed ? (
          <Callout tone="neg" urgent>
            {t.admin.states.actionFailed}
          </Callout>
        ) : null}
        <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-4">
          {text('symbol', {
            disabled: dialog.editing !== null,
            autoCapitalize: 'characters',
            className: 'uppercase',
          })}
          {text('name')}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label={copy.fields.sector} error={errorOf('sector')}>
            {(field) => (
              <Select
                {...field}
                value={dialog.draft.sector}
                onChange={(event) => {
                  dialog.actions.set('sector', event.target.value as StockDraft['sector']);
                }}
              >
                <option value="" disabled>
                  {copy.selectSector}
                </option>
                {SECTORS.map((sector) => (
                  <option key={sector} value={sector}>
                    {t.sectors[sector]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={copy.fields.exchange} error={errorOf('exchange')}>
            {(field) => (
              <Select
                {...field}
                value={dialog.draft.exchange}
                onChange={(event) => {
                  dialog.actions.set('exchange', event.target.value as StockDraft['exchange']);
                }}
              >
                <option value="" disabled>
                  {copy.selectExchange}
                </option>
                {EXCHANGES.map((exchange) => (
                  <option key={exchange} value={exchange}>
                    {exchange}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {text('basePrice', {
            inputMode: 'decimal',
            prefix: f.currencyAffix(),
            className: 'tabular-nums',
          })}
          {text('volatility', { inputMode: 'decimal', className: 'tabular-nums' })}
          {text('peRatio', {
            inputMode: 'decimal',
            placeholder: copy.optional,
            className: 'tabular-nums',
          })}
        </div>
        <div className="bg-surface-3 flex items-center justify-between gap-4 rounded-xl px-3.5 py-3">
          <span>
            <b id="enable-now" className="type-sm text-fg">
              {copy.enableNow}
            </b>
            <span className="type-caption text-fg-3 block">{copy.enableNowHint}</span>
          </span>
          <Switch
            aria-labelledby="enable-now"
            checked={dialog.draft.isEnabled}
            onCheckedChange={(checked) => {
              dialog.actions.set('isEnabled', checked);
            }}
          />
        </div>
      </form>
    </Dialog>
  );
}
