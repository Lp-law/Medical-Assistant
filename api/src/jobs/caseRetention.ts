import cron from 'node-cron';
import { CaseStatus } from '@prisma/client';
import { prisma } from '../services/prisma';
import {
  FINAL_WARNING_THRESHOLD_DAYS,
  RETENTION_DAYS,
  WARNING_THRESHOLD_DAYS,
  addDays,
  buildPublicCaseResponse,
  calculateDaysRemaining,
  deleteCaseAndAssets,
} from '../services/caseLifecycle';
import { createNotification } from '../services/notificationService';
import { logAuditEvent } from '../services/auditLogger';

const DAYS = 24 * 60 * 60 * 1000;

const nowUtc = () => new Date();

const markCasesAsWarned = async (ids: string[]) => {
  if (!ids.length) return;
  await prisma.case.updateMany({
    where: { id: { in: ids } },
    data: { retentionWarningSent: true },
  });
};

const markCasesAsFinalWarned = async (ids: string[]) => {
  if (!ids.length) return;
  await prisma.case.updateMany({
    where: { id: { in: ids } },
    data: { retentionFinalWarningSent: true, status: CaseStatus.PENDING_DELETE },
  });
};

export const runCaseRetentionCycle = async (referenceDate: Date = nowUtc()): Promise<void> => {
  const warningDate = addDays(referenceDate, WARNING_THRESHOLD_DAYS);
  const finalWarningDate = addDays(referenceDate, FINAL_WARNING_THRESHOLD_DAYS);

  const warnCandidates = await prisma.case.findMany({
    where: {
      status: CaseStatus.ACTIVE,
      archivedAt: null,
      retentionWarningSent: false,
      retentionExpiresAt: { lte: warningDate },
    },
  });

  if (warnCandidates.length) {
    await Promise.all(
      warnCandidates.map(async (record) => {
        await createNotification({
          userId: record.ownerId,
          type: 'CASE_RETENTION_WARNING',
          caseId: record.id,
          message: `התיק "${record.title}" יימחק בעוד ${calculateDaysRemaining(
            record.retentionExpiresAt,
            referenceDate,
          )} ימים. מומלץ לייצא או לארכב.`,
          metadata: buildPublicCaseResponse(record, record.ownerId),
        });
      }),
    );
    await markCasesAsWarned(warnCandidates.map((record) => record.id));
  }

  const finalWarningCandidates = await prisma.case.findMany({
    where: {
      status: { in: [CaseStatus.ACTIVE, CaseStatus.PENDING_DELETE] },
      archivedAt: null,
      retentionFinalWarningSent: false,
      retentionExpiresAt: { lte: finalWarningDate },
    },
  });

  if (finalWarningCandidates.length) {
    await Promise.all(
      finalWarningCandidates.map(async (record) => {
        await createNotification({
          userId: record.ownerId,
          type: 'CASE_RETENTION_FINAL_WARNING',
          caseId: record.id,
          message: `התיק "${record.title}" יימחק בתוך שלושה ימים. אנא אשר מחיקה או תחדש את התיק.`,
          metadata: buildPublicCaseResponse(record, record.ownerId),
        });
      }),
    );
    await markCasesAsFinalWarned(finalWarningCandidates.map((record) => record.id));
  }

  const expiredCases = await prisma.case.findMany({
    where: {
      status: { in: [CaseStatus.ACTIVE, CaseStatus.PENDING_DELETE] },
      archivedAt: null,
      retentionExpiresAt: { lte: referenceDate },
    },
  });

  for (const record of expiredCases) {
    await deleteCaseAndAssets(record, { logRetention: true });
    await createNotification({
      userId: record.ownerId,
      type: 'CASE_RETENTION_PURGED',
      message: `התיק "${record.title}" הוסר מתוקף מדיניות השמירה.`,
    });
  }
};

export const startCaseRetentionJobs = (): void => {
  cron.schedule(
    '0 2 * * *',
    () => {
      runCaseRetentionCycle().catch((error) => console.error('[retention] failed to run cycle', error));
    },
    { timezone: 'UTC' },
  );
};

