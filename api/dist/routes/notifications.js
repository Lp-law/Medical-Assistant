"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const notificationService_1 = require("../services/notificationService");
exports.notificationsRouter = (0, express_1.Router)();
exports.notificationsRouter.use(auth_1.requireAuth);
exports.notificationsRouter.get('/', async (req, res) => {
    const notifications = await (0, notificationService_1.listUserNotifications)(req.user.id);
    res.json({ notifications });
});
exports.notificationsRouter.post('/:id/read', async (req, res) => {
    await (0, notificationService_1.markNotificationRead)(req.params.id, req.user.id);
    res.status(204).end();
});
