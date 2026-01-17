ALTER TABLE "KnowledgeDocument"
ADD COLUMN "reasoningFindings" JSONB NOT NULL DEFAULT '[]'::jsonb;

