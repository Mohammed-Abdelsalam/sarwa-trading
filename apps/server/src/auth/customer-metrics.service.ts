import { Injectable } from '@nestjs/common';

import { type CustomerKpis } from '@sarwa/contracts';
import { marketClock, marketTime, ratioBps } from '@sarwa/domain';

import { Clock } from '../common/clock';
import { PrismaService } from '../prisma.service';

const DAY_MS = 86_400_000;
const MOBILE = ['ios', 'android'];

// Guests are counted by device: a visit is a socket opened without a signed-in session.
@Injectable()
export class CustomerMetrics {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async recordGuestVisit(deviceId: string): Promise<void> {
    const now = new Date(this.clock.now());
    await this.prisma.device.upsert({
      where: { id: deviceId },
      update: { lastSeenAt: now },
      create: { id: deviceId, createdAt: now, lastSeenAt: now },
    });
  }

  // "Today" is the exchange's day in New York, like the admin order stats. Deltas compare with
  // the same figure a week ago.
  async kpis(): Promise<CustomerKpis> {
    const now = this.clock.now();
    const today = new Date(marketTime(marketClock(now).date, 0));
    const weekAgo = new Date(now - 7 * DAY_MS);
    const dayAgo = new Date(now - DAY_MS);
    const user = this.prisma.user;
    const customers = { status: { not: 'deleted' } };
    const [
      registered,
      registeredThen,
      signedUpToday,
      mobileToday,
      active24h,
      suspended,
      suspendedToday,
      verified,
      verifiedThen,
      signedUp24h,
      guests24h,
    ] = await this.prisma.$transaction([
      user.count({ where: customers }),
      user.count({ where: { ...customers, createdAt: { lte: weekAgo } } }),
      user.count({ where: { createdAt: { gte: today } } }),
      user.count({ where: { createdAt: { gte: today }, signupPlatform: { in: MOBILE } } }),
      user.count({ where: { ...customers, lastActiveAt: { gte: dayAgo } } }),
      user.count({ where: { status: 'suspended' } }),
      user.count({ where: { status: 'suspended', suspendedAt: { gte: today } } }),
      user.count({ where: { ...customers, emailVerifiedAt: { not: null } } }),
      user.count({ where: { ...customers, emailVerifiedAt: { lte: weekAgo } } }),
      user.count({ where: { createdAt: { gte: dayAgo } } }),
      this.prisma.device.count({ where: { lastSeenAt: { gte: dayAgo } } }),
    ]);
    const verifiedBps = ratioBps(verified, registered);
    return {
      registered,
      registeredWeekBps: ratioBps(registered - registeredThen, registeredThen),
      signedUpToday,
      signedUpTodayMobileBps: ratioBps(mobileToday, signedUpToday),
      active24h,
      suspended,
      suspendedToday,
      verifiedBps,
      verifiedDeltaBps: verifiedBps - ratioBps(verifiedThen, registeredThen),
      guests24h,
      conversionBps: ratioBps(signedUp24h, guests24h),
    };
  }
}
