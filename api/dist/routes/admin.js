"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const emailFetcher_1 = require("../jobs/emailFetcher");
exports.adminRouter = (0, express_1.Router)();
exports.adminRouter.use(auth_1.requireAuth);
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ error: 'auth_required' });
        return;
    }
    if (req.user.isAdmin !== true) {
        res.status(403).json({ error: 'forbidden' });
        return;
    }
    next();
};
const safeNumber = (value) => {
    const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
    if (value > maxSafe)
        return value.toString();
    return Number(value);
};
// Manual trigger for IMAP ingestion (same logic as cron), admin-only.
exports.adminRouter.post('/email-ingest-now', requireAdmin, async (_req, res) => {
    try {
        const result = await (0, emailFetcher_1.runEmailFetcherOnce)();
        res.json({
            processedMessages: result.fetched,
            documentsCreated: result.processed,
            lastUid: safeNumber(result.lastUid),
            success: true,
        });
    }
    catch (error) {
        res.status(500).json({
            processedMessages: 0,
            documentsCreated: 0,
            lastUid: 0,
            success: false,
            error: error?.message ?? 'email_ingest_failed',
        });
    }
});
