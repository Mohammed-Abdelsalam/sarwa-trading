-- AlterTable
ALTER TABLE "Stock" ADD COLUMN "dayHighTicks" BIGINT;
ALTER TABLE "Stock" ADD COLUMN "dayLowTicks" BIGINT;
ALTER TABLE "Stock" ADD COLUMN "openTicks" BIGINT;
ALTER TABLE "Stock" ADD COLUMN "prevCloseTicks" BIGINT;
ALTER TABLE "Stock" ADD COLUMN "tradingDate" TEXT;
