"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markNotificationRead = exports.listUserNotifications = exports.createNotification = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("./prisma");
const createNotification = async (input) => {
    try {
        await prisma_1.prisma.notification.create({
            data: {
                userId: input.userId,
                type: input.type,
                message: input.message,
                caseId: input.caseId ?? null,
                metadata: input.metadata ?? client_1.Prisma.JsonNull,
            },
        });
    }
    catch (error) {
        console.warn('[notifications] failed to create notification', error);
    }
};
exports.createNotification = createNotification;
const listUserNotifications = async (userId) => {
    return prisma_1.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
};
exports.listUserNotifications = listUserNotifications;
const markNotificationRead = async (notificationId, userId) => {
    await prisma_1.prisma.notification.updateMany({
        where: { id: notificationId, userId },
        data: { readAt: new Date() },
    });
};
exports.markNotificationRead = markNotificationRead;
