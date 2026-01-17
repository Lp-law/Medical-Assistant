ALTER TABLE "KnowledgeDocument"
ADD COLUMN "literatureQueries" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "LiteratureResource"
ADD COLUMN "pmid" TEXT,
ADD COLUMN "journal" TEXT,
ADD COLUMN "year" INTEGER,
ADD COLUMN "source" TEXT,
ADD COLUMN "url" TEXT,
ADD COLUMN "oaPdfUrl" TEXT,
ADD COLUMN "pmcId" TEXT,
ADD COLUMN "pmcUrl" TEXT,
ADD COLUMN "oaCheckedAt" TIMESTAMPTZ,
ADD COLUMN "downloadStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "localPath" TEXT,
ADD COLUMN "downloadedAt" TIMESTAMPTZ,
ADD COLUMN "summaryJson" JSONB,
ADD COLUMN "license" TEXT,
ADD COLUMN "oaStatus" TEXT NOT NULL DEFAULT 'unknown';

