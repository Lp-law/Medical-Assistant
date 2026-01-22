-- Add Document + EmailIngestionState for internal knowledge base (email/manual ingestion)

CREATE TYPE "DocumentCategory" AS ENUM ('JUDGMENT', 'DAMAGE_ESTIMATE', 'SUMMARY');
CREATE TYPE "DocumentSource" AS ENUM ('EMAIL', 'MANUAL');

CREATE TABLE "Document" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "content" TEXT,
  "category" "DocumentCategory" NOT NULL,
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "topics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "source" "DocumentSource" NOT NULL,
  "emailFrom" TEXT,
  "emailSubject" TEXT,
  "emailDate" TIMESTAMPTZ,
  "emailMessageId" TEXT UNIQUE,
  "attachmentUrl" TEXT,
  "attachmentMime" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "EmailIngestionState" (
  "mailbox" TEXT PRIMARY KEY,
  "lastUid" BIGINT NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "Document_category_idx" ON "Document" ("category");
CREATE INDEX "Document_source_idx" ON "Document" ("source");
CREATE INDEX "Document_emailDate_idx" ON "Document" ("emailDate");
CREATE INDEX "Document_createdAt_idx" ON "Document" ("createdAt");


