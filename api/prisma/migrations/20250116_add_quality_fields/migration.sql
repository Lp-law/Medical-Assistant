ALTER TABLE "KnowledgeDocument"
ADD COLUMN "qualityFindings" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN "medicalQualityScore" INTEGER NOT NULL DEFAULT 0;

