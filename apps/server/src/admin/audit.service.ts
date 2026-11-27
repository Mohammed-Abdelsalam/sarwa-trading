import { Global, Injectable, Module } from '@nestjs/common';
import { type AuditLog as AuditLogRow } from '@prisma/client';

import { type AuditAction, type AuditLog, type AuditPage, type AuditQuery } from '@sarwa/contracts';

import { PrismaService, type Tx } from '../prisma.service';

export interface Actor {
  email: string;
  ip?: string | undefined;
}

export interface AuditEntry {
  actorEmail: string;
  action: AuditAction;
  entity: string;
  payload?: Record<string, unknown>;
  ip?: string | undefined;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  // Pass the transaction client so the audit row commits (or rolls back) with the change it records.
  async log(
    { actorEmail, action, entity, payload = {}, ip }: AuditEntry,
    tx: Tx = this.prisma,
  ): Promise<void> {
    await tx.auditLog.create({
      data: { actorEmail, action, entity, payload: JSON.stringify(payload), ip: ip ?? null },
    });
  }

  async list({ page = 1, pageSize = 25, action, actor }: AuditQuery): Promise<AuditPage> {
    const where = {
      ...(action && { action }),
      ...(actor && { actorEmail: { contains: actor } }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items: rows.map(toAuditLog), page: Number(page), pageSize: Number(pageSize), total };
  }

  async recent(take: number): Promise<AuditLog[]> {
    const rows = await this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take });
    return rows.map(toAuditLog);
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}

function toAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    actorEmail: row.actorEmail,
    action: row.action as AuditAction,
    entity: row.entity,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    ip: row.ip,
    createdAt: row.createdAt.toISOString(),
  };
}
