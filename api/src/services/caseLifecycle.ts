import { Case, CaseStatus, Prisma } from '@prisma/client';
import crypto from 'crypto';
import { prisma } from './prisma';
import { logAuditEvent } from './auditLogger';

export const RETENTION_DAYS = 90;
export const WARNING_THRESHOLD_DAYS = 15;
export const FINAL_WARNING_THRESHOLD_DAYS = 3;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

const CATEGORY_MAP: Array<{ regex: RegExp; summary: string }> = [
  { regex: /(orthoped|spine|גב|עמוד שדרה)/i, summary: 'מחלוקת אורטופדית כללית' },
  { regex: /(cardio|לב|חזה|לבבי)/i, summary: 'סוגיה קרדיולוגית' },
  { regex: /(neuro|שבץ|נויר|ראש)/i, summary: 'אירוע נוירולוגי' },
  { regex: /(psychi|נפש|פסיכ)/i, summary: 'בחינה פסיכיאטרית' },
  { regex: /(trauma|פגיעה|תאונה|injury)/i, summary: 'תיק פגיעת גוף כללי' },
  { regex: /(obgyn|מייל|לידה|הריון|pregnancy)/i, summary: 'תיק מיילדות וגינקולוגיה' },
];

const sanitizeText = (value: string): string => {
  return value
    .replace(/[0-9]/g, '')
    .replace(/[^א-תa-zA-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const generateCaseTopicSummary = (title: string, data?: Prisma.JsonValue): string => {
  const dataSummary =
    data && typeof data === 'object' && data !== null && 'summary' in (data as Record<string, unknown>)
      ? String((data as Record<string, unknown>).summary ?? '')
      : '';
  const source = `${title ?? ''} ${dataSummary ?? ''}`;
  const sanitized = sanitizeText(source);
  const category = CATEGORY_MAP.find((entry) => entry.regex.test(sanitized));
  if (category) return category.summary;
  if (sanitized.length >= 6) {
    return sanitized.slice(0, 60);
  }
  return 'תיק רפואי משפטי';
};

export const addDays = (date: Date, days: number): Date => {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
};

export const calculateDaysRemaining = (expiresAt: Date, reference: Date = new Date()): number => {
  const diff = expiresAt.getTime() - reference.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / MS_IN_DAY);
};

export const buildOwnerCaseResponse = (record: Case, viewerId: string) => ({
  id: record.id,
  title: record.title,
  topicSummary: record.topicSummary,
  data: record.data,
  status: record.status,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  lastAccessedAt: record.lastAccessedAt,
  retentionExpiresAt: record.retentionExpiresAt,
  archivedAt: record.archivedAt,
  retentionWarningSent: record.retentionWarningSent,
  retentionFinalWarningSent: record.retentionFinalWarningSent,
  daysRemaining: calculateDaysRemaining(record.retentionExpiresAt),
  ownerUserId: record.ownerId,
  isOwner: record.ownerId === viewerId,
});

export const buildPublicCaseResponse = (record: Case, viewerId: string) => ({
  id: record.id,
  title: record.title,
  topicSummary: record.topicSummary,
  status: record.status,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  daysRemaining: calculateDaysRemaining(record.retentionExpiresAt),
  ownerUserId: record.ownerId,
  isOwner: record.ownerId === viewerId,
});

const extractLinkedKnowledgeIds = (record: Case): string[] => {
  if (!record.data || typeof record.data !== 'object') return [];
  const payload = record.data as Record<string, unknown>;
  const possibleKeys = ['knowledgeDocumentIds', 'documents', 'medicalDocs'];
  for (const key of possibleKeys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value.filter((entry) => typeof entry === 'string') as string[];
    }
  }
  return [];
};

const hashValue = (value: string): string => {
  return crypto.createHash('sha256').update(value).digest('hex');
};

export const deleteCaseAndAssets = async (record: Case, options: { logRetention?: boolean } = {}): Promise<void> => {
  const linkedKnowledgeIds = extractLinkedKnowledgeIds(record);
  const docIds = new Set(linkedKnowledgeIds);

  if (docIds.size > 0) {
    await prisma.literatureResource.deleteMany({
      where: { knowledgeId: { in: Array.from(docIds) } },
    });
    await prisma.knowledgeDocument.deleteMany({
      where: { id: { in: Array.from(docIds) } },
    });
  }

  await prisma.notification.deleteMany({
    where: { caseId: record.id },
  });

  await prisma.case.delete({ where: { id: record.id } });

  if (options.logRetention) {
    await logAuditEvent({
      action: 'CASE_RETENTION_DELETE',
      entityType: 'case',
      entityId: record.id,
      metadata: {
        titleDigest: hashValue(record.title),
        createdAt: record.createdAt.toISOString(),
        retentionExpiresAt: record.retentionExpiresAt.toISOString(),
      },
    });
  }
};

