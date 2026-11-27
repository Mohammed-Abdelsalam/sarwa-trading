-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "emailVerifiedAt" DATETIME,
    "passwordChangedAt" DATETIME,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "deletionRequestedAt" DATETIME,
    "signupPlatform" TEXT NOT NULL DEFAULT 'web',
    "suspensionCategory" TEXT,
    "suspensionReason" TEXT,
    "suspendedAt" DATETIME,
    "suspendedBy" TEXT,
    "createdAt" DATETIME NOT NULL,
    "lastActiveAt" DATETIME
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "keepSignedIn" BOOLEAN NOT NULL,
    "platform" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "browser" TEXT,
    "os" TEXT,
    "model" TEXT,
    "ip" TEXT,
    "ipMasked" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "lastUsedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "rotatedAt" DATETIME,
    "revokedAt" DATETIME,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "acceptedAt" DATETIME,
    "revokedAt" DATETIME
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT,
    "userId" TEXT,
    "handle" TEXT NOT NULL,
    "cashCents" BIGINT NOT NULL,
    "epoch" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL,
    "resetAt" DATETIME,
    CONSTRAINT "Account_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Account" ("cashCents", "createdAt", "deviceId", "epoch", "handle", "id", "resetAt") SELECT "cashCents", "createdAt", "deviceId", "epoch", "handle", "id", "resetAt" FROM "Account";
DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";
CREATE UNIQUE INDEX "Account_deviceId_key" ON "Account"("deviceId");
CREATE UNIQUE INDEX "Account_userId_key" ON "Account"("userId");
CREATE UNIQUE INDEX "Account_handle_key" ON "Account"("handle");
CREATE TABLE "new_PushToken" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PushToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- Device rows move to that device's paper account. A device that never opened one has nothing a
-- push could be about, so its tokens are dropped.
INSERT INTO "new_PushToken" ("accountId", "platform", "token", "updatedAt") SELECT "Account"."id", "PushToken"."platform", "PushToken"."token", "PushToken"."updatedAt" FROM "PushToken" JOIN "Account" ON "Account"."deviceId" = "PushToken"."deviceId";
DROP TABLE "PushToken";
ALTER TABLE "new_PushToken" RENAME TO "PushToken";
CREATE INDEX "PushToken_accountId_idx" ON "PushToken"("accountId");
CREATE TABLE "new_WatchlistItem" (
    "accountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("accountId", "symbol"),
    CONSTRAINT "WatchlistItem_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WatchlistItem_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Stock" ("symbol") ON DELETE CASCADE ON UPDATE CASCADE
);
-- The watchlist now needs an account: stars of a device without one can't be kept.
INSERT INTO "new_WatchlistItem" ("accountId", "createdAt", "symbol") SELECT "Account"."id", "WatchlistItem"."createdAt", "WatchlistItem"."symbol" FROM "WatchlistItem" JOIN "Account" ON "Account"."deviceId" = "WatchlistItem"."deviceId";
DROP TABLE "WatchlistItem";
ALTER TABLE "new_WatchlistItem" RENAME TO "WatchlistItem";
CREATE INDEX "WatchlistItem_symbol_idx" ON "WatchlistItem"("symbol");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_lastActiveAt_idx" ON "User"("lastActiveAt");

-- CreateIndex
CREATE INDEX "User_deletionRequestedAt_idx" ON "User"("deletionRequestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshHash_key" ON "Session"("refreshHash");

-- CreateIndex
CREATE INDEX "Session_familyId_idx" ON "Session"("familyId");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminInvite_tokenHash_key" ON "AdminInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminInvite_email_idx" ON "AdminInvite"("email");

-- CreateIndex
CREATE INDEX "AuditLog_entity_createdAt_idx" ON "AuditLog"("entity", "createdAt");

-- CreateIndex
CREATE INDEX "Device_lastSeenAt_idx" ON "Device"("lastSeenAt");
