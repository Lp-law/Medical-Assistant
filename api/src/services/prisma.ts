import { PrismaClient } from '@prisma/client';
import { config } from './env';

// Keep this aligned with the compiled dist version and the rest of the codebase
// which assumes a ready Prisma client.
export const prisma = new PrismaClient();

export const ensureUserRecord = async (id: string, username: string, role: string): Promise<void> => {
  // In some deployments (e.g. early Render setup) we may not have a DB wired yet.
  // Auth should still work; persisting the user record is best-effort.
  if (!config.databaseUrl) {
    return;
  }
  try {
    await prisma.user.upsert({
      where: { id },
      update: { username, role },
      create: { id, username, role },
    });
  } catch (error) {
    console.warn('[prisma] ensureUserRecord failed', error);
  }
};
