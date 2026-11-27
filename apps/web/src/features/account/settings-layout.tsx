'use client';

import { type Route } from 'next';
import Link from 'next/link';
import { type ReactNode } from 'react';

import { cn } from '@sarwa/ui';

import { useCopy } from '../../lib/i18n';
import { SETTINGS_SECTIONS, type SettingsSection } from './settings-sections';

export function settingsHref(section: SettingsSection): Route {
  return (section === 'profile' ? '/settings/security#profile' : `/settings/${section}`) as Route;
}

export function SettingsLayout({
  section,
  children,
}: {
  section: Exclude<SettingsSection, 'profile'>;
  children: ReactNode;
}) {
  const { t } = useCopy();
  return (
    <div className="mx-auto flex w-full max-w-250 flex-col gap-5 px-4 py-6 md:px-8">
      <h1 className="type-h1">{t.settings.title}</h1>
      <div className="grid gap-5 md:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label={t.settings.title}>
          <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:overflow-visible md:px-0">
            {SETTINGS_SECTIONS.map((item) => (
              <li key={item} className="shrink-0">
                <Link
                  href={settingsHref(item)}
                  aria-current={item === section ? 'page' : undefined}
                  className={cn(
                    'type-sm text-fg-2 hover:bg-surface-3 hover:text-fg focus-visible:outline-focus flex h-9 items-center rounded-md px-3 font-semibold focus-visible:outline-2',
                    item === section && 'bg-surface-3 text-fg',
                    item === 'danger' && 'text-neg hover:text-neg',
                  )}
                >
                  {t.account.sections[item]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}
