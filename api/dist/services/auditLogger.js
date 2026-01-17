"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAuditEvent = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("./prisma");
const logAuditEvent = async (event) => {
    try {
        await prisma_1.prisma.auditEvent.create({
            data: {
                userId: event.userId ?? null,
                action: event.action,
                entity: event.entityType ?? null,
                entityId: event.entityId ?? null,
                metadata: event.metadata ?? client_1.Prisma.JsonNull,
            },
        });
    }
    catch (error) {
        console.warn('[audit] failed to persist audit event', error);
    }
};
exports.logAuditEvent = logAuditEvent;
