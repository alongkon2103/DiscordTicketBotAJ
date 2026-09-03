/*
  Warnings:

  - You are about to drop the column `channelId` on the `Announcement` table. All the data in the column will be lost.
  - You are about to drop the column `error` on the `Announcement` table. All the data in the column will be lost.
  - You are about to drop the column `messageId` on the `Announcement` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "AnnouncementDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "announcementId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "sentAt" DATETIME,
    CONSTRAINT "AnnouncementDelivery_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '',
    "payload" TEXT NOT NULL DEFAULT '{}',
    "mentionMode" TEXT NOT NULL DEFAULT 'none',
    "mentionRoleIds" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" DATETIME,
    "sentAt" DATETIME,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Announcement" ("createdAt", "createdById", "id", "mentionMode", "mentionRoleIds", "name", "payload", "scheduledAt", "sentAt", "status", "updatedAt") SELECT "createdAt", "createdById", "id", "mentionMode", "mentionRoleIds", "name", "payload", "scheduledAt", "sentAt", "status", "updatedAt" FROM "Announcement";
DROP TABLE "Announcement";
ALTER TABLE "new_Announcement" RENAME TO "Announcement";
CREATE INDEX "Announcement_status_scheduledAt_idx" ON "Announcement"("status", "scheduledAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AnnouncementDelivery_announcementId_idx" ON "AnnouncementDelivery"("announcementId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementDelivery_announcementId_channelId_key" ON "AnnouncementDelivery"("announcementId", "channelId");
