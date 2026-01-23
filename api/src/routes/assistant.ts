import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../services/prisma';
import { generateSearchQueries } from '../services/openAIClient';

const router = Router();
router.use(requireAuth);

const bodySchema = z.object({
  question: z.string().min(3).max(2000),
  limit: z.number().int().min(1).max(50).optional(),
  categoryName: z.string().min(1).max(120).optional(),
});

type AssistantDocumentHit = {
  id: string;
  title: string;
  summary: string;
  categoryName: string;
  source: string;
  attachmentUrl: string | null;
  createdAt: string;
};

const searchDocumentsByQuery = async (
  q: string,
  limit: number,
  categoryName?: string,
): Promise<AssistantDocumentHit[]> => {
  const ilike = `%${q}%`;
  const categoryNameVal = categoryName ? `%${categoryName}%` : null;
  const rows = await prisma.$queryRaw<any[]>(
    Prisma.sql`
      SELECT
        "d"."id",
        "d"."title",
        "d"."summary",
        "d"."source",
        "d"."attachmentUrl",
        "d"."createdAt",
        "c"."name" AS "category_name"
      FROM "Document" "d"
      JOIN "Category" "c" ON "c"."id" = "d"."categoryId"
      WHERE (
        "d"."title" ILIKE ${ilike} OR
        "d"."summary" ILIKE ${ilike} OR
        COALESCE("d"."content", '') ILIKE ${ilike} OR
        array_to_string("d"."topics", ' ') ILIKE ${ilike} OR
        array_to_string("d"."keywords", ' ') ILIKE ${ilike}
      )
      AND (${categoryNameVal}::text IS NULL OR "c"."name" ILIKE ${categoryNameVal})
      ORDER BY "d"."createdAt" DESC
      LIMIT ${limit}
    `,
  );

  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ''),
    summary: String(row.summary ?? ''),
    categoryName: String(row.category_name ?? ''),
    source: String(row.source ?? ''),
    attachmentUrl: row.attachmentUrl ? String(row.attachmentUrl) : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? ''),
  }));
};

router.post('/search', async (req, res) => {
  const parsed = bodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.errors });
    return;
  }

  const limit = parsed.data.limit ?? 10;
  const question = parsed.data.question.trim();
  const categoryName = parsed.data.categoryName?.trim() || undefined;

  const queries = await generateSearchQueries(question);
  const effectiveQueries = queries.length ? queries : [question];

  const hitCounts = new Map<string, { hit: AssistantDocumentHit; score: number }>();
  for (const q of effectiveQueries.slice(0, 5)) {
    const hits = await searchDocumentsByQuery(q, limit, categoryName);
    for (const hit of hits) {
      const existing = hitCounts.get(hit.id);
      if (existing) {
        existing.score += 1;
      } else {
        hitCounts.set(hit.id, { hit, score: 1 });
      }
    }
  }

  const documents = Array.from(hitCounts.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.hit);

  res.json({
    queries: effectiveQueries,
    documents,
  });
});

export const assistantRouter = router;


