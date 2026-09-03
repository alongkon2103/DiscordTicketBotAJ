-- CreateTable
CREATE TABLE "GuildSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "adminRoleIds" TEXT NOT NULL DEFAULT '[]',
    "ticketLogChannelId" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TicketType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "disabledMessage" TEXT NOT NULL DEFAULT 'ตอนนี้ปิดรับ ticket ประเภทนี้ชั่วคราว',
    "categoryIds" TEXT NOT NULL DEFAULT '[]',
    "channelNameTemplate" TEXT NOT NULL DEFAULT 'ticket-{number}',
    "archiveCategoryId" TEXT,
    "staffRoleIds" TEXT NOT NULL DEFAULT '[]',
    "allowedRoleIds" TEXT NOT NULL DEFAULT '[]',
    "deniedRoleIds" TEXT NOT NULL DEFAULT '[]',
    "modalTitle" TEXT NOT NULL DEFAULT 'เปิด Ticket',
    "openPayload" TEXT NOT NULL DEFAULT '{}',
    "pingOpener" BOOLEAN NOT NULL DEFAULT true,
    "pingRoleIds" TEXT NOT NULL DEFAULT '[]',
    "showAnswers" BOOLEAN NOT NULL DEFAULT true,
    "maxOpenPerUser" INTEGER NOT NULL DEFAULT 1,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ModalField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketTypeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "config" TEXT NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ModalField_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Panel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "channelId" TEXT,
    "messageId" TEXT,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "layout" TEXT NOT NULL DEFAULT 'buttons',
    "selectPlaceholder" TEXT,
    "lastPublishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PanelItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "emoji" TEXT,
    "style" TEXT NOT NULL DEFAULT 'secondary',
    "row" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PanelItem_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PanelItem_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "openerId" TEXT NOT NULL,
    "openerTag" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "answers" TEXT NOT NULL DEFAULT '{}',
    "addedUserIds" TEXT NOT NULL DEFAULT '[]',
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "closedById" TEXT,
    "closedByTag" TEXT,
    "closeReason" TEXT,
    CONSTRAINT "Ticket_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TicketTranscript" (
    "ticketId" TEXT NOT NULL PRIMARY KEY,
    "messages" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketTranscript_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MemberEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" TEXT,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "autoRoleIds" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '',
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "mentionMode" TEXT NOT NULL DEFAULT 'none',
    "mentionRoleIds" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" DATETIME,
    "sentAt" DATETIME,
    "error" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT NOT NULL,
    "actorTag" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "detail" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ModalField_ticketTypeId_idx" ON "ModalField"("ticketTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ModalField_ticketTypeId_key_key" ON "ModalField"("ticketTypeId", "key");

-- CreateIndex
CREATE INDEX "PanelItem_panelId_idx" ON "PanelItem"("panelId");

-- CreateIndex
CREATE INDEX "PanelItem_ticketTypeId_idx" ON "PanelItem"("ticketTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_number_key" ON "Ticket"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_channelId_key" ON "Ticket"("channelId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_openerId_idx" ON "Ticket"("openerId");

-- CreateIndex
CREATE INDEX "Ticket_ticketTypeId_idx" ON "Ticket"("ticketTypeId");

-- CreateIndex
CREATE INDEX "Announcement_status_scheduledAt_idx" ON "Announcement"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
