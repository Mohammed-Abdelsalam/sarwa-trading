import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { ErrorCode, type HealthResponse } from '@sarwa/contracts';

import { Public } from './auth/customer.guard';
import { PrismaService } from './prisma.service';
import { TradingEngine } from './trading/engine.service';

const { version } = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
  version: string;
};
// CI and deploys set GIT_SHA; a local run has no build to point at.
const sha = process.env.GIT_SHA?.trim() ?? '';
const commit = sha ? sha.slice(0, 7) : 'dev';

type Check = 'ok' | 'down';

// Probes poll often from one address, so they are never rate limited.
@SkipThrottle()
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: TradingEngine,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    if ((await this.database()) === 'down') throw unavailable('Database unavailable');
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()), version, commit };
  }

  // The process is up; restarting it is the only fix for a failure here.
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  // Safe to route traffic: the database answers and the engine has loaded its working orders.
  @Get('ready')
  async ready(): Promise<{ status: 'ok'; checks: Record<'database' | 'engine', Check> }> {
    const checks = {
      database: await this.database(),
      engine: this.engine.isLoaded() ? 'ok' : 'down',
    } satisfies Record<string, Check>;
    const down = Object.entries(checks).filter(([, state]) => state === 'down');
    if (down.length > 0) throw unavailable(`Not ready: ${down.map(([name]) => name).join(', ')}`);
    return { status: 'ok', checks };
  }

  private async database(): Promise<Check> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'down';
    }
  }
}

const unavailable = (message: string) =>
  new ServiceUnavailableException({ code: ErrorCode.Unavailable, message });
