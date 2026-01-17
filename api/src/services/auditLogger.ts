import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export interface AuditEventPayload {
  action: string;
  userId?: string;
  entityId?: string;
  entityType?: string;
  metadata?: Record<string, unknown>;
}

export const logAuditEvent = async (event: AuditEventPayload): Promise<void> => {
  try {
    await prisma.auditEvent.create({
      data: {
        userId: event.userId ?? null,
        action: event.action,
        entity: event.entityType ?? null,
        entityId: event.entityId ?? null,
        metadata: (event.metadata as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
      },
    });
  } catch (error) {
    console.warn('[audit] failed to persist audit event', error);
  }
};

