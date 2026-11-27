-- AlterTable
ALTER TABLE "Stock" ADD COLUMN "lastTicks" BIGINT;

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "cashCents" BIGINT NOT NULL,
    "epoch" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL,
    "resetAt" DATETIME,
    CONSTRAINT "Account_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Position" (
    "accountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "qtyMicros" BIGINT NOT NULL,
    "costBasisCents" BIGINT NOT NULL,

    PRIMARY KEY ("accountId", "symbol"),
    CONSTRAINT "Position_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Position_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Stock" ("symbol") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "epoch" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tif" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "qtyMicros" BIGINT,
    "amountCents" BIGINT,
    "sellAll" BOOLEAN NOT NULL DEFAULT false,
    "limitTicks" BIGINT,
    "stopTicks" BIGINT,
    "quotedTicks" BIGINT NOT NULL,
    "filledMicros" BIGINT NOT NULL DEFAULT 0,
    "filledNotionalCents" BIGINT NOT NULL DEFAULT 0,
    "filledExactNotional" TEXT NOT NULL DEFAULT '0',
    "heldCents" BIGINT NOT NULL DEFAULT 0,
    "heldMicros" BIGINT NOT NULL DEFAULT 0,
    "holdPriceTicks" BIGINT,
    "rejection" TEXT,
    "cancelReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "triggeredAt" DATETIME,
    "expiresAt" DATETIME,
    "closedAt" DATETIME,
    CONSTRAINT "Order_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Stock" ("symbol") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Fill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "epoch" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "qtyMicros" BIGINT NOT NULL,
    "priceTicks" BIGINT NOT NULL,
    "notionalCents" BIGINT NOT NULL,
    "realizedCents" BIGINT NOT NULL,
    "at" DATETIME NOT NULL,
    CONSTRAINT "Fill_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Fill_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Fill_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Stock" ("symbol") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "thresholdTicks" BIGINT,
    "thresholdBps" INTEGER,
    "repeat" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "armed" BOOLEAN NOT NULL DEFAULT true,
    "lastFiredAt" DATETIME,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "Alert_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Alert_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Stock" ("symbol") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "Notification_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" TEXT NOT NULL,
    "epoch" INTEGER NOT NULL,
    "t" DATETIME NOT NULL,
    "equityCents" BIGINT NOT NULL,
    CONSTRAINT "PortfolioSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushToken" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PushToken_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Halt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "since" DATETIME NOT NULL,
    "resumesAt" DATETIME,
    "endedAt" DATETIME,
    "createdBy" TEXT
);

-- CreateTable
CREATE TABLE "TradingConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "tradingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sessionMode" TEXT NOT NULL DEFAULT 'always-open',
    "rules" TEXT NOT NULL,
    "circuitBreaker" TEXT NOT NULL,
    "changedBy" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_deviceId_key" ON "Account"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_handle_key" ON "Account"("handle");

-- CreateIndex
CREATE INDEX "Position_symbol_idx" ON "Position"("symbol");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_symbol_status_idx" ON "Order"("symbol", "status");

-- CreateIndex
CREATE INDEX "Order_accountId_createdAt_idx" ON "Order"("accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_accountId_idempotencyKey_key" ON "Order"("accountId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Fill_orderId_idx" ON "Fill"("orderId");

-- CreateIndex
CREATE INDEX "Fill_accountId_at_idx" ON "Fill"("accountId", "at");

-- CreateIndex
CREATE INDEX "Fill_at_idx" ON "Fill"("at");

-- CreateIndex
CREATE INDEX "Alert_accountId_idx" ON "Alert"("accountId");

-- CreateIndex
CREATE INDEX "Alert_enabled_idx" ON "Alert"("enabled");

-- CreateIndex
CREATE INDEX "Notification_accountId_createdAt_idx" ON "Notification"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_accountId_epoch_t_idx" ON "PortfolioSnapshot"("accountId", "epoch", "t");

-- CreateIndex
CREATE INDEX "PushToken_deviceId_idx" ON "PushToken"("deviceId");

-- CreateIndex
CREATE INDEX "Halt_symbol_endedAt_idx" ON "Halt"("symbol", "endedAt");
