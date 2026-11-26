import { z } from 'zod';

import { BANNER_MAX_LENGTH, PERIODS } from './constants';
import { PeriodSchema } from './market';

export const BannerToneSchema = z.enum(['info', 'warning']);

export const BannerSchema = z.object({
  message: z.string().trim().min(1).max(BANNER_MAX_LENGTH),
  tone: BannerToneSchema,
});

export const AppConfigSchema = z.object({
  maintenanceMode: z.boolean(),
  banner: BannerSchema.nullable(),
  enabledPeriods: z
    .array(PeriodSchema)
    .min(1, 'At least one chart period must stay enabled')
    .refine((periods) => new Set(periods).size === periods.length, 'Periods must be unique'),
  updatedAt: z.number().int().nonnegative(),
});

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
