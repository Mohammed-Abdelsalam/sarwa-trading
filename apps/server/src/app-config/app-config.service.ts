import { Injectable, type OnModuleInit } from '@nestjs/common';
import { type AppConfig as AppConfigRow } from '@prisma/client';
import { Subject } from 'rxjs';

import { type AppConfig, type Period, type UpdateAppConfig } from '@sarwa/contracts';

import { type Actor, AuditService } from '../admin/audit.service';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AppConfigService implements OnModuleInit {
  readonly changes$ = new Subject<AppConfig>();
  private config!: AppConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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

  async update(patch: UpdateAppConfig, actor: Actor): Promise<AppConfig> {
    const { updatedAt: _, ...before } = this.config;
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.appConfig.update({
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
      const { updatedAt: __, ...after } = toAppConfig(updated);
      await this.audit.log(
        {
          actorEmail: actor.email,
          action: 'config.update',
          entity: `Config · ${Object.keys(patch).join(', ')}`,
          payload: { before, after },
          ip: actor.ip,
        },
        tx,
      );
      return updated;
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
