'use client';

import { Check, CircleCheck, Megaphone, TriangleAlert, Wrench, X } from 'lucide-react';

import { BannerToneSchema, PERIODS } from '@sarwa/contracts';
import { marketTime } from '@sarwa/core';
import { CONFIG_APPLY_SECONDS, marketClock, useAdminI18n } from '@sarwa/core/admin';
import {
  Badge,
  Button,
  Callout,
  Card,
  Chip,
  cn,
  ConnectionBadge,
  Field,
  Input,
  Logo,
  SegmentedControl,
  Skeleton,
} from '@sarwa/ui';

import {
  GuardedButton,
  GuardedSwitch,
  ReadOnlyBadge,
  ViewerNotice,
} from '../../components/common/access';
import { LoadError, PageHeader } from '../../components/common/states';
import { type ConfigPageModel, useConfigPage } from './use-config-page';

// The placeholder suggests a typical early-close notice (1:00 PM ET).
const EARLY_CLOSE_AT = marketTime(marketClock(Date.now()).date, 13 * 60);

function Preview({ page }: { page: ConfigPageModel }) {
  const { t } = useAdminI18n();
  const copy = t.admin.config;
  const draft = page.draft;
  if (!draft) return null;
  const message = draft.bannerMessage.trim();
  return (
    <aside
      aria-label={copy.preview}
      className="border-border bg-surface-3 flex flex-col gap-3.5 rounded-lg border border-dashed p-5"
    >
      <div className="flex items-center justify-between">
        <span className="type-overline text-fg-3">{copy.preview}</span>
        <span className="type-caption text-fg-3">{copy.previewHint}</span>
      </div>
      <span className="type-caption text-fg-2 font-semibold">{copy.mobile}</span>
      <div className="border-border bg-bg flex flex-col gap-2.5 rounded-[20px] border p-3.5">
        <div className="flex items-center justify-between">
          <span className="type-h2 text-fg">{copy.markets}</span>
          <ConnectionBadge status="live" label={copy.live} />
        </div>
        {message ? (
          <div
            className={cn(
              'type-sm text-fg flex items-center gap-2.5 rounded-lg border px-3 py-2',
              draft.bannerTone === 'warning'
                ? 'border-warn/30 bg-warn-subtle'
                : 'border-brand/35 bg-brand-subtle',
            )}
          >
            <Megaphone aria-hidden className="size-4 shrink-0" />
            <span className="flex-1">{message}</span>
            <X aria-hidden className="text-fg-3 size-3.5" />
          </div>
        ) : null}
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-9 animate-none rounded-[10px]" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-2.5 w-1/2 animate-none" />
            <Skeleton className="h-2 w-2/3 animate-none" />
          </div>
        </div>
      </div>
      <span className="type-caption text-fg-2 font-semibold">{copy.web}</span>
      <div className="border-border bg-bg overflow-hidden rounded-xl border">
        <div className="border-border bg-surface flex h-10 items-center border-b px-3">
          <Logo className="text-xs" />
        </div>
        {message ? (
          <div
            className={cn(
              'type-caption text-fg flex items-center gap-2 px-3 py-2',
              draft.bannerTone === 'warning' ? 'bg-warn-subtle' : 'bg-brand-subtle',
            )}
          >
            <Megaphone aria-hidden className="text-brand-fg size-3.5" />
            <span className="flex-1">{message}</span>
          </div>
        ) : null}
        <div className="h-16" />
      </div>
      {draft.maintenanceMode ? (
        <Callout tone="warn" icon={<Wrench />} className="text-xs">
          {copy.maintenancePreview}
        </Callout>
      ) : null}
    </aside>
  );
}

function SaveBar({ page }: { page: ConfigPageModel }) {
  const { t, f } = useAdminI18n();
  const copy = t.admin.config;
  const clean = page.changes === 0;
  const maintenance = page.draft?.maintenanceMode === true && !clean;
  return (
    <div
      role="region"
      aria-label={copy.saveRegion}
      className={cn(
        'border-border bg-surface flex items-center justify-between gap-4 rounded-[14px] border py-3 ps-5 pe-4',
        clean ? 'shadow-e1 dark:shadow-none' : 'shadow-e2',
      )}
    >
      <span className="type-sm text-fg flex items-center gap-2.5">
        {clean ? (
          <CircleCheck aria-hidden className="text-pos size-4" />
        ) : (
          <TriangleAlert aria-hidden className="text-warn size-4" />
        )}
        {page.isSaving
          ? copy.saving
          : clean
            ? copy.upToDate
            : copy.pending({ n: f.number(page.changes) })}
      </span>
      <div className="flex gap-2">
        <Button variant="ghost" disabled={clean || page.isSaving} onClick={page.actions.discard}>
          {copy.discard}
        </Button>
        <GuardedButton
          locked={!page.canEdit}
          variant={maintenance ? 'danger' : 'primary'}
          disabled={clean}
          loading={page.isSaving}
          onClick={page.actions.save}
        >
          {page.isSaving ? copy.savingButton : maintenance ? copy.saveMaintenance : copy.save}
        </GuardedButton>
      </div>
    </div>
  );
}

export function ConfigPage() {
  const page = useConfigPage();
  const { t, f } = useAdminI18n();
  const copy = t.admin.config;
  const draft = page.draft;

  return (
    <>
      {page.isViewer ? <ViewerNotice /> : null}
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle({ n: f.number(CONFIG_APPLY_SECONDS) })}
      >
        {page.isViewer ? <ReadOnlyBadge /> : null}
        {draft ? (
          <Badge tone={page.changes === 0 ? 'pos' : 'warn'} role="status">
            {page.changes === 0 ? copy.allSaved : copy.unsaved({ n: f.number(page.changes) })}
          </Badge>
        ) : null}
      </PageHeader>
      {page.isError && !draft ? (
        <LoadError what={copy.loading} onRetry={page.actions.retry} />
      ) : !draft ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_28.75rem]">
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((card) => (
              <Skeleton key={card} className="h-32 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-lg" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_28.75rem]">
            <div className="flex min-w-0 flex-col gap-4">
              <Card className="flex flex-col gap-3.5 px-6 py-5.5">
                <div className="flex items-center justify-between gap-6">
                  <div>
                    <h2 id="maintenance" className="type-h3 text-fg">
                      {copy.maintenance}
                    </h2>
                    <p className="type-sm text-fg-2">{copy.maintenanceBody}</p>
                  </div>
                  <GuardedSwitch
                    locked={!page.canEdit}
                    aria-labelledby="maintenance"
                    checked={draft.maintenanceMode}
                    className="data-[state=checked]:bg-warn"
                    onCheckedChange={page.actions.setMaintenance}
                  />
                </div>
                {draft.maintenanceMode ? (
                  <Callout tone="warn" icon={<TriangleAlert />} role="alert">
                    <b>{copy.maintenanceWarnTitle({ n: f.number(page.clients) })}</b>{' '}
                    {copy.maintenanceWarnBody}
                  </Callout>
                ) : null}
              </Card>
              <Card className="flex flex-col gap-3.5 px-6 py-5.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="type-h3 text-fg">{copy.banner}</h2>
                    <p className="type-sm text-fg-2">{copy.bannerBody}</p>
                  </div>
                  <Badge tone="brand">
                    {draft.bannerMessage.trim() ? copy.visible : copy.hidden}
                  </Badge>
                </div>
                <Field label={copy.message} hint={copy.messageHint}>
                  {(field) => (
                    <Input
                      {...field}
                      inputSize="lg"
                      maxLength={page.maxLength}
                      disabled={!page.canEdit}
                      placeholder={copy.messagePlaceholder({ time: f.time(EARLY_CLOSE_AT) })}
                      value={draft.bannerMessage}
                      onChange={(event) => {
                        page.actions.setMessage(event.target.value);
                      }}
                    />
                  )}
                </Field>
                <span className="type-caption text-fg-3 -mt-2 self-end tabular-nums">
                  {copy.length({
                    n: f.number(draft.bannerMessage.length),
                    max: f.number(page.maxLength),
                  })}
                </span>
                <div className="flex items-center gap-3">
                  <span className="type-sm text-fg-2">{copy.tone}</span>
                  <SegmentedControl
                    label={copy.tone}
                    options={BannerToneSchema.options.map((tone) => ({
                      value: tone,
                      label: copy.tones[tone],
                    }))}
                    value={draft.bannerTone}
                    onChange={page.actions.setTone}
                    disabled={!page.canEdit}
                  />
                </div>
              </Card>
              <Card className="flex flex-col gap-3.5 px-6 py-5.5">
                <div>
                  <h2 className="type-h3 text-fg">{copy.periods}</h2>
                  <p className="type-sm text-fg-2">{copy.periodsBody}</p>
                </div>
                <div role="group" aria-label={copy.periodsLabel} className="flex flex-wrap gap-2.5">
                  {PERIODS.map((period) => {
                    const on = draft.enabledPeriods.includes(period);
                    return (
                      <Chip
                        key={period}
                        active={on}
                        aria-pressed={on}
                        disabled={!page.canEdit}
                        className="min-w-18 justify-center disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => {
                          page.actions.togglePeriod(period);
                        }}
                      >
                        {on ? (
                          <Check aria-hidden className="size-3.5" />
                        ) : (
                          <X aria-hidden className="size-3.5" />
                        )}
                        {period}
                      </Chip>
                    );
                  })}
                </div>
              </Card>
            </div>
            <Preview page={page} />
          </div>
          {page.failed ? (
            <Callout tone="neg" urgent>
              {t.admin.states.actionFailed}
            </Callout>
          ) : null}
          <SaveBar page={page} />
        </>
      )}
    </>
  );
}
