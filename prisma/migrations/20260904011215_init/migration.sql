-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "GuildSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "adminRoleIds" TEXT NOT NULL DEFAULT '[]',
    "ticketLogChannelId" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketType" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModalField" (
    "id" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "config" TEXT NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ModalField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Panel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channelId" TEXT,
    "messageId" TEXT,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "layout" TEXT NOT NULL DEFAULT 'buttons',
    "selectPlaceholder" TEXT,
    "lastPublishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Panel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanelItem" (
    "id" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "emoji" TEXT,
    "style" TEXT NOT NULL DEFAULT 'secondary',
    "row" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PanelItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "openerId" TEXT NOT NULL,
    "openerTag" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "answers" TEXT NOT NULL DEFAULT '{}',
    "addedUserIds" TEXT NOT NULL DEFAULT '[]',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closedByTag" TEXT,
    "closeReason" TEXT,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTranscript" (
    "ticketId" TEXT NOT NULL,
    "messages" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketTranscript_pkey" PRIMARY KEY ("ticketId")
);

-- CreateTable
CREATE TABLE "MemberEvent" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" TEXT,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "autoRoleIds" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberLog" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userTag" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "payload" TEXT NOT NULL DEFAULT '{}',
    "mentionMode" TEXT NOT NULL DEFAULT 'none',
    "mentionRoleIds" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementDelivery" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "AnnouncementDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorTag" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "detail" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "MemberLog_kind_createdAt_idx" ON "MemberLog"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "MemberLog_createdAt_idx" ON "MemberLog"("createdAt");

-- CreateIndex
CREATE INDEX "Announcement_status_scheduledAt_idx" ON "Announcement"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "AnnouncementDelivery_announcementId_idx" ON "AnnouncementDelivery"("announcementId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementDelivery_announcementId_channelId_key" ON "AnnouncementDelivery"("announcementId", "channelId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ModalField" ADD CONSTRAINT "ModalField_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelItem" ADD CONSTRAINT "PanelItem_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelItem" ADD CONSTRAINT "PanelItem_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTranscript" ADD CONSTRAINT "TicketTranscript_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementDelivery" ADD CONSTRAINT "AnnouncementDelivery_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

