import { PrismaClient } from '@prisma/client';

// Keep this aligned with the compiled dist version and the rest of the codebase
// which assumes a ready Prisma client.
export const prisma = new PrismaClient();

export const ensureUserRecord = async (id: string, username: string, role: string): Promise<void> => {
  await prisma.user.upsert({
    where: { id },
    update: { username, role },
    create: { id, username, role },
  });
};
