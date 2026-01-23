-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'PENDING_DELETE');

-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('EMAIL', 'MANUAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topicSummary" TEXT NOT NULL DEFAULT '',
    "data" JSONB NOT NULL DEFAULT '{}',
    "status" "CaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastAccessedAt" TIMESTAMP(3),
    "retentionExpiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "retentionWarningSent" BOOLEAN NOT NULL DEFAULT false,
    "retentionFinalWarningSent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "claims" JSONB NOT NULL,
    "flags" JSONB NOT NULL,
    "score" JSONB NOT NULL,
    "timeline" JSONB NOT NULL DEFAULT '[]',
    "qualityFindings" JSONB NOT NULL DEFAULT '[]',
    "medicalQualityScore" INTEGER NOT NULL DEFAULT 0,
    "literatureQueries" JSONB NOT NULL DEFAULT '[]',
    "reasoningFindings" JSONB NOT NULL DEFAULT '[]',
    "ocrMode" TEXT NOT NULL DEFAULT 'base',
    "ocrLexicalMap" JSONB NOT NULL,
    "insights" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "caseId" TEXT,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteratureResource" (
    "id" TEXT NOT NULL,
    "knowledgeId" TEXT NOT NULL,
    "doi" TEXT,
    "pmid" TEXT,
    "title" TEXT NOT NULL,
    "authors" JSONB NOT NULL,
    "journal" TEXT,
    "year" INTEGER,
    "source" TEXT,
    "url" TEXT,
    "oaStatus" TEXT NOT NULL DEFAULT 'unknown',
    "oaUrl" TEXT,
    "oaPdfUrl" TEXT,
    "pmcId" TEXT,
    "pmcUrl" TEXT,
    "license" TEXT,
    "oaCheckedAt" TIMESTAMP(3),
    "downloadStatus" TEXT NOT NULL DEFAULT 'pending',
    "localPath" TEXT,
    "downloadedAt" TIMESTAMP(3),
    "summaryJson" JSONB,
    "linkedClaimIds" JSONB NOT NULL DEFAULT '[]',
    "summaryQuality" TEXT NOT NULL DEFAULT 'unknown',
    "summaryQualityNote" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiteratureResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "caseId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "content" TEXT,
    "categoryId" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" "DocumentSource" NOT NULL,
    "emailFrom" TEXT,
    "emailSubject" TEXT,
    "emailDate" TIMESTAMP(3),
    "emailMessageId" TEXT,
    "attachmentUrl" TEXT,
    "attachmentMime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailIngestionState" (
    "mailbox" TEXT NOT NULL,
    "lastUid" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailIngestionState_pkey" PRIMARY KEY ("mailbox")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Document_emailMessageId_key" ON "Document"("emailMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteratureResource" ADD CONSTRAINT "LiteratureResource_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

