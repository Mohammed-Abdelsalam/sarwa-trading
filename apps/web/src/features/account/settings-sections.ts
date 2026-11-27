export const SETTINGS_SECTIONS = [
  'profile',
  'security',
  'notifications',
  'appearance',
  'trading',
  'danger',
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
// Profile has no page of its own: it is the top of the security page.
export const SETTINGS_PAGES = SETTINGS_SECTIONS.filter(
  (section): section is Exclude<SettingsSection, 'profile'> => section !== 'profile',
);
