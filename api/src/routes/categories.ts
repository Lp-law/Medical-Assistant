import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

const DEFAULT_CATEGORIES = ['פסקי דין', 'ספרות', 'תחשיבי נזק', 'סיכומים', 'חוות דעת'] as const;

const ensureDefaultCategories = async (): Promise<void> => {
  await Promise.all(
    DEFAULT_CATEGORIES.map(async (name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      await prisma.category.upsert({
        where: { name: trimmed },
        update: {},
        create: { name: trimmed },
      });
    }),
  );
};

categoriesRouter.get('/', async (_req, res) => {
  await ensureDefaultCategories();
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  res.json({ categories });
});

const createSchema = z.object({
  name: z.string().min(1).max(80),
});

categoriesRouter.post('/', requireRole('admin'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.errors });
    return;
  }

  const name = parsed.data.name.trim();
  const existing = await prisma.category.findUnique({ where: { name } });
  if (existing) {
    res.json({ category: existing });
    return;
  }

  const created = await prisma.category.create({ data: { name } });
  res.status(201).json({ category: created });
});

const updateSchema = z.object({
  name: z.string().min(1).max(80),
});

categoriesRouter.put('/:id', requireRole('admin'), async (req, res) => {
  const id = req.params.id;
  const parsed = updateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.errors });
    return;
  }
  const name = parsed.data.name.trim();
  try {
    const updated = await prisma.category.update({ where: { id }, data: { name } });
    res.json({ category: updated });
  } catch (error) {
    res.status(404).json({ error: 'not_found' });
  }
});

categoriesRouter.delete('/:id', requireRole('admin'), async (req, res) => {
  const id = req.params.id;
  try {
    await prisma.category.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    // Could be not found, or FK constraint if documents exist
    res.status(400).json({ error: 'delete_failed' });
  }
});


