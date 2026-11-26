import { Injectable, type OnModuleInit } from '@nestjs/common';
import { type AppConfig as AppConfigRow } from '@prisma/client';
import { Subject } from 'rxjs';

import { type AppConfig, type Period, type UpdateAppConfig } from '@sarwa/contracts';

import { PrismaService } from '../prisma.service';

@Injectable()
export class AppConfigService implements OnModuleInit {
  readonly changes$ = new Subject<AppConfig>();
  private config!: AppConfig;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const row = await this.prisma.appConfig.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
    this.config = toAppConfig(row);
  }

  get(): AppConfig {
    return this.config;
  }

  async update(patch: UpdateAppConfig): Promise<AppConfig> {
    const row = await this.prisma.appConfig.update({
      where: { id: 1 },
      data: {
        maintenanceMode: patch.maintenanceMode,
        ...(patch.banner !== undefined && {
          bannerMessage: patch.banner?.message ?? null,
          bannerTone: patch.banner?.tone ?? 'info',
        }),
        enabledPeriods: patch.enabledPeriods?.join(','),
      },
    });
    this.config = toAppConfig(row);
    this.changes$.next(this.config);
    return this.config;
  }
}

function toAppConfig(row: AppConfigRow): AppConfig {
  return {
    maintenanceMode: row.maintenanceMode,
    banner: row.bannerMessage
      ? { message: row.bannerMessage, tone: row.bannerTone === 'warning' ? 'warning' : 'info' }
      : null,
    enabledPeriods: row.enabledPeriods.split(',') as Period[],
    updatedAt: row.updatedAt.getTime(),
  };
}
