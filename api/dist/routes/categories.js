"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoriesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../services/prisma");
const auth_1 = require("../middleware/auth");
exports.categoriesRouter = (0, express_1.Router)();
exports.categoriesRouter.use(auth_1.requireAuth);
exports.categoriesRouter.get('/', async (_req, res) => {
    const categories = await prisma_1.prisma.category.findMany({ orderBy: { name: 'asc' } });
    res.json({ categories });
});
const createSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(80),
});
exports.categoriesRouter.post('/', (0, auth_1.requireRole)('admin'), async (req, res) => {
    const parsed = createSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        res.status(400).json({ error: 'invalid_body', details: parsed.error.errors });
        return;
    }
    const name = parsed.data.name.trim();
    const existing = await prisma_1.prisma.category.findUnique({ where: { name } });
    if (existing) {
        res.json({ category: existing });
        return;
    }
    const created = await prisma_1.prisma.category.create({ data: { name } });
    res.status(201).json({ category: created });
});
const updateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(80),
});
exports.categoriesRouter.put('/:id', (0, auth_1.requireRole)('admin'), async (req, res) => {
    const id = req.params.id;
    const parsed = updateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        res.status(400).json({ error: 'invalid_body', details: parsed.error.errors });
        return;
    }
    const name = parsed.data.name.trim();
    try {
        const updated = await prisma_1.prisma.category.update({ where: { id }, data: { name } });
        res.json({ category: updated });
    }
    catch (error) {
        res.status(404).json({ error: 'not_found' });
    }
});
exports.categoriesRouter.delete('/:id', (0, auth_1.requireRole)('admin'), async (req, res) => {
    const id = req.params.id;
    try {
        await prisma_1.prisma.category.delete({ where: { id } });
        res.status(204).end();
    }
    catch (error) {
        // Could be not found, or FK constraint if documents exist
        res.status(400).json({ error: 'delete_failed' });
    }
});
