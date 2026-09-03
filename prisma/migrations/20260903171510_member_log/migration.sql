-- CreateTable
CREATE TABLE "MemberLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userTag" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "MemberLog_kind_createdAt_idx" ON "MemberLog"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "MemberLog_createdAt_idx" ON "MemberLog"("createdAt");
