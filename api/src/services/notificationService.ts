import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

interface NotificationInput {
  userId: string;
  type: string;
  message: string;
  caseId?: string;
  metadata?: Record<string, unknown>;
}

export const createNotification = async (input: NotificationInput): Promise<void> => {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        message: input.message,
        caseId: input.caseId ?? null,
        metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
      },
    });
  } catch (error) {
    console.warn('[notifications] failed to create notification', error);
  }
};

export const listUserNotifications = async (userId: string) => {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
};

export const markNotificationRead = async (notificationId: string, userId: string): Promise<void> => {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
};

