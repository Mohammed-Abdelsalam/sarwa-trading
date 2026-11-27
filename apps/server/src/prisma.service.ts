import {
  Global,
  Injectable,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { type Prisma, PrismaClient } from '@prisma/client';

export type Tx = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
    // WAL lets readers run while the engine writes; the busy timeout waits out short write locks.
    await this.$queryRawUnsafe('PRAGMA journal_mode = WAL');
    await this.$queryRawUnsafe('PRAGMA busy_timeout = 5000');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
