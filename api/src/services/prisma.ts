import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export const ensureUserRecord = async (id: string, username: string, role: string): Promise<void> => {
  await prisma.user.upsert({
    where: { id },
    update: { username, role },
    create: { id, username, role },
  });
};

