"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auditLogger_1 = require("../services/auditLogger");
const authService_1 = require("../services/authService");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../services/prisma");
const router = (0, express_1.Router)();
const loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1),
    password: zod_1.z.string().min(1),
});
router.post('/login', async (req, res) => {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ error: 'invalid_body' });
        return;
    }
    const { username, password } = parseResult.data;
    const user = await (0, authService_1.validateUserCredentials)(username, password);
    if (!user) {
        await (0, auditLogger_1.logAuditEvent)({
            action: 'AUTH_LOGIN_FAILED',
            metadata: { username },
        });
        res.status(401).json({ error: 'invalid_credentials' });
        return;
    }
    const token = (0, authService_1.signAccessToken)(user);
    await (0, prisma_1.ensureUserRecord)(user.id, user.username, user.role);
    await (0, auditLogger_1.logAuditEvent)({
        action: 'AUTH_LOGIN_SUCCESS',
        userId: user.id,
    });
    res.json({ token, user });
});
router.get('/me', auth_1.requireAuth, (req, res) => {
    res.json({ user: req.user });
});
exports.authRouter = router;
