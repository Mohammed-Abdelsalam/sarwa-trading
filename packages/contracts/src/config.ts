import { z } from 'zod';

import { BANNER_MAX_LENGTH, PERIODS } from './constants';
import { PeriodSchema } from './market';

/**
 * Remote app config ("feature flags"), edited in Admin › Config and pushed live to every
 * mobile and web client over the socket (`config:updated`).
 */

export const BannerToneSchema = z.enum(['info', 'warning']);

export const BannerSchema = z.object({
  /** plain text, no links (design system: "Plain text, no links") */
  message: z.string().trim().min(1).max(BANNER_MAX_LENGTH),
  tone: BannerToneSchema,
});

export const AppConfigSchema = z.object({
  /** replaces every client screen with "We'll be right back"; admin stays available */
  maintenanceMode: z.boolean(),
  /** null = hidden */
  banner: BannerSchema.nullable(),
  /** periods shown enabled in PeriodTabs; at least one must stay on */
  enabledPeriods: z
    .array(PeriodSchema)
    .min(1, 'At least one chart period must stay enabled')
    .refine((periods) => new Set(periods).size === periods.length, 'Periods must be unique'),
  /** epoch ms; lets clients ignore an older config that arrives late */
  updatedAt: z.number().int().nonnegative(),
});

/** What the admin sends: any subset; `updatedAt` is set by the server. */
export const UpdateAppConfigSchema = AppConfigSchema.omit({ updatedAt: true }).partial();

export const DEFAULT_APP_CONFIG: Omit<AppConfig, 'updatedAt'> = {
  maintenanceMode: false,
  banner: null,
  enabledPeriods: [...PERIODS],
};

export type BannerTone = z.infer<typeof BannerToneSchema>;
export type Banner = z.infer<typeof BannerSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;
export type UpdateAppConfig = z.infer<typeof UpdateAppConfigSchema>;
