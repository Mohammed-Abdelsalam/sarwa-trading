'use client';

import { type ReactNode } from 'react';

import { Button, Card, EstimateRows, SegmentedControl } from '@sarwa/ui';

import { useSettingsPage } from './use-settings-page';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-4 px-5 py-4.5">
      <h2 className="type-h3">{title}</h2>
      {children}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="type-sm font-semibold">{label}</span>
      {children}
    </div>
  );
}

export type PreferenceSection = 'notifications' | 'appearance' | 'trading';

// The device preferences behind the settings nav; guests have them too.
export function PreferenceSettings({ section }: { section: PreferenceSection }) {
  const page = useSettingsPage();
  const { labels, actions } = page;

  if (section === 'notifications')
    return (
      <Section title={labels.notifications}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="type-sm text-fg-2 max-w-110">{labels.permission[page.permission]}</p>
          {page.permission === 'default' ? (
            <Button variant="secondary" onClick={actions.enableNotifications}>
              {labels.enable}
            </Button>
          ) : null}
        </div>
      </Section>
    );
  if (section === 'trading')
    return (
      <Section title={labels.account}>
        <EstimateRows rows={page.account} />
        <p className="type-caption text-fg-3">{labels.disclosure}</p>
      </Section>
    );
  return (
    <>
      <Section title={labels.appearance}>
        <Row label={labels.theme}>
          <SegmentedControl
            label={labels.theme}
            value={page.theme}
            onChange={actions.setTheme}
            options={labels.themes}
          />
        </Row>
      </Section>
      <Section title={labels.languageRegion}>
        <Row label={labels.language}>
          <SegmentedControl
            label={labels.language}
            value={page.locale}
            onChange={actions.setLocale}
            options={labels.languages}
          />
        </Row>
        <Row label={labels.digits}>
          <SegmentedControl
            label={labels.digits}
            value={page.digits}
            onChange={actions.setDigits}
            options={labels.digitOptions}
          />
        </Row>
      </Section>
    </>
  );
}
