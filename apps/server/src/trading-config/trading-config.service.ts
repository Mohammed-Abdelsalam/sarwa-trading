import { Injectable, type OnModuleInit } from '@nestjs/common';
import { type TradingConfig as TradingConfigRow } from '@prisma/client';
import { Subject } from 'rxjs';

import {
  CircuitBreakerSchema,
  ExecutionRulesSchema,
  SessionModeSchema,
  toDomain,
  type UpdateTrading,
} from '@sarwa/contracts';
import {
  type CircuitBreakerRules,
  DEFAULT_CIRCUIT_BREAKER,
  DEFAULT_EXECUTION_RULES,
  type ExecutionRules,
  type SessionMode,
} from '@sarwa/domain';

import { type Actor, AuditService } from '../admin/audit.service';
import { ValidationException } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma.service';

export interface TradingSettings {
  tradingEnabled: boolean;
  sessionMode: SessionMode;
  rules: ExecutionRules;
  circuitBreaker: CircuitBreakerRules;
  changedBy: string | null;
  changedAt: number | null;
}

export const DEFAULT_TRADING_CONFIG = {
  tradingEnabled: true,
  sessionMode: 'always-open',
  rules: JSON.stringify(DEFAULT_EXECUTION_RULES),
  circuitBreaker: JSON.stringify(DEFAULT_CIRCUIT_BREAKER),
} as const;

@Injectable()
export class TradingConfigService implements OnModuleInit {
  readonly changes$ = new Subject<TradingSettings>();
  private settings!: TradingSettings;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    const row = await this.prisma.tradingConfig.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, ...DEFAULT_TRADING_CONFIG },
    });
    this.settings = toSettings(row);
  }

  get(): TradingSettings {
    return this.settings;
  }

  async update(patch: UpdateTrading, actor: Actor): Promise<TradingSettings> {
    const before = this.settings;
    const rules = { ...before.rules, ...patch.rules };
    if (rules.minNotionalCents >= rules.maxNotionalCents) {
      throw new ValidationException({
        'rules.minNotionalCents': ['Min notional must be below max notional'],
      });
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tradingConfig.update({
        where: { id: 1 },
        data: {
          tradingEnabled: patch.tradingEnabled,
          sessionMode: patch.sessionMode,
          rules: JSON.stringify(rules),
          circuitBreaker: JSON.stringify({ ...before.circuitBreaker, ...patch.circuitBreaker }),
          changedBy: actor.email,
        },
      });
      await this.audit.log(
        {
          actorEmail: actor.email,
          action: 'trading.update',
          entity: `Trading · ${Object.keys(patch).join(', ')}`,
          payload: { before: auditView(before), after: auditView(toSettings(updated)) },
          ip: actor.ip,
        },
        tx,
      );
      return updated;
    });
    this.settings = toSettings(row);
    this.changes$.next(this.settings);
    return this.settings;
  }
}

function auditView({ changedBy: _, changedAt: __, ...settings }: TradingSettings) {
  return settings;
}

// Merged over the defaults so a rule added later still has a value on an older row.
function toSettings(row: TradingConfigRow): TradingSettings {
  return {
    tradingEnabled: row.tradingEnabled,
    sessionMode: SessionModeSchema.catch('always-open').parse(row.sessionMode),
    rules: toDomain<ExecutionRules>(
      ExecutionRulesSchema.parse({
        ...DEFAULT_EXECUTION_RULES,
        ...(JSON.parse(row.rules) as object),
      }),
    ),
    circuitBreaker: toDomain<CircuitBreakerRules>(
      CircuitBreakerSchema.parse({
        ...DEFAULT_CIRCUIT_BREAKER,
        ...(JSON.parse(row.circuitBreaker) as object),
      }),
    ),
    changedBy: row.changedBy,
    changedAt: row.changedBy ? row.updatedAt.getTime() : null,
  };
}
