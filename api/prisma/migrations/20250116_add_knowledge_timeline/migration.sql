ALTER TABLE "KnowledgeDocument"
ADD COLUMN "timeline" JSONB NOT NULL DEFAULT '[]'::jsonb;

