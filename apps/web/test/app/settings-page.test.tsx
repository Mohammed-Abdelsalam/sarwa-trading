import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SETTINGS_PAGES } from '../../src/features/account/settings-sections';

const source = (path: string) => readFileSync(join(__dirname, '../../src', path), 'utf8');

// A server component gets a client-reference proxy, not the array, for values from a client module.
it('the settings route reads its sections from a server-safe module', () => {
  expect(SETTINGS_PAGES).toEqual(['security', 'notifications', 'appearance', 'trading', 'danger']);
  expect(source('features/account/settings-sections.ts')).not.toMatch(/['"]use client['"]/);
  expect(source('app/settings/[section]/page.tsx')).toContain(
    "from '../../../features/account/settings-sections'",
  );
});
