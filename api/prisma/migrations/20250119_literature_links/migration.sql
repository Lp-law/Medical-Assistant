ALTER TABLE "LiteratureResource"
ADD COLUMN "linkedClaimIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN "summaryQuality" TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN "summaryQualityNote" TEXT;

