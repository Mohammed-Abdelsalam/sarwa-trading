import { useI18n } from '@sarwa/core';
import { NUMERIC_RULES, RULE_UNITS } from '@sarwa/core/admin';
import { Button, Callout, Card, Input, Switch } from '@sarwa/ui';

import { Locked } from '../../components/common/access';
import { type RulesFormModel } from './use-trading-page';

export function RulesForm({ form, canEdit }: { form: RulesFormModel; canEdit: boolean }) {
  const { t } = useI18n();
  const draft = form.draft;
  if (!draft) return null;

  const errorFor = (key: keyof typeof form.errors) => {
    const error = form.errors[key];
    if (!error) return undefined;
    if (key === 'minNotionalCents' && error === 'range') return t.admin.trading.minBelowMax;
    return error === 'required' || error === 'invalid' || error === 'range'
      ? t.admin.trading.ruleErrors[error]
      : undefined;
  };

  return (
    <Card className="flex flex-col gap-1 px-4.5 py-4">
      <h2 className="type-h3 text-fg mb-1.5">{t.admin.executionRules}</h2>
      <form
        noValidate
        aria-label={t.admin.executionRules}
        onSubmit={(event) => {
          event.preventDefault();
          form.actions.save();
        }}
      >
        {NUMERIC_RULES.map((key) => {
          const unit = RULE_UNITS[key];
          const error = errorFor(key);
          const id = `rule-${key}`;
          return (
            <div
              key={key}
              className="border-border grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-3 border-b py-1.75"
            >
              <div>
                <label htmlFor={id} className="type-sm text-fg font-semibold">
                  {t.admin.rules[key].label}
                </label>
                <p className="type-caption text-fg-3">{t.admin.rules[key].hint}</p>
                {error ? (
                  <p id={`${id}-error`} role="alert" className="text-neg text-xs font-medium">
                    {error}
                  </p>
                ) : null}
              </div>
              <Input
                id={id}
                inputMode="decimal"
                className="h-8.5 text-end tabular-nums"
                prefix={unit === 'dollars' ? t.admin.trading.units.dollars : undefined}
                suffix={unit === 'dollars' ? undefined : t.admin.trading.units[unit]}
                disabled={!canEdit}
                aria-invalid={error !== undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                value={draft[key]}
                onChange={(event) => {
                  form.actions.set(key, event.target.value);
                }}
              />
            </div>
          );
        })}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1.75">
          <div>
            <span id="rule-queue" className="type-sm text-fg font-semibold">
              {t.admin.rules.queueWhenClosed.label}
            </span>
            <p className="type-caption text-fg-3">{t.admin.rules.queueWhenClosed.hint}</p>
          </div>
          <Locked locked={!canEdit}>
            <Switch
              aria-labelledby="rule-queue"
              checked={draft.queueWhenClosed}
              disabled={!canEdit}
              onCheckedChange={(checked) => {
                form.actions.set('queueWhenClosed', checked);
              }}
            />
          </Locked>
        </div>
        {form.failed ? (
          <Callout tone="neg" urgent className="mt-2">
            {t.admin.states.actionFailed}
          </Callout>
        ) : null}
        <div className="flex justify-end gap-2 pt-2.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!form.dirty}
            onClick={form.actions.discard}
          >
            {t.common.discard}
          </Button>
          <Locked locked={!canEdit}>
            <Button
              type="submit"
              size="sm"
              loading={form.isSaving}
              disabled={!canEdit || !form.dirty}
            >
              {t.admin.saveRules}
            </Button>
          </Locked>
        </div>
      </form>
    </Card>
  );
}
