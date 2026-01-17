"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCaseAndAssets = exports.buildPublicCaseResponse = exports.buildOwnerCaseResponse = exports.calculateDaysRemaining = exports.addDays = exports.generateCaseTopicSummary = exports.FINAL_WARNING_THRESHOLD_DAYS = exports.WARNING_THRESHOLD_DAYS = exports.RETENTION_DAYS = void 0;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("./prisma");
const auditLogger_1 = require("./auditLogger");
exports.RETENTION_DAYS = 90;
exports.WARNING_THRESHOLD_DAYS = 15;
exports.FINAL_WARNING_THRESHOLD_DAYS = 3;
const MS_IN_DAY = 24 * 60 * 60 * 1000;
const CATEGORY_MAP = [
    { regex: /(orthoped|spine|גב|עמוד שדרה)/i, summary: 'מחלוקת אורטופדית כללית' },
    { regex: /(cardio|לב|חזה|לבבי)/i, summary: 'סוגיה קרדיולוגית' },
    { regex: /(neuro|שבץ|נויר|ראש)/i, summary: 'אירוע נוירולוגי' },
    { regex: /(psychi|נפש|פסיכ)/i, summary: 'בחינה פסיכיאטרית' },
    { regex: /(trauma|פגיעה|תאונה|injury)/i, summary: 'תיק פגיעת גוף כללי' },
    { regex: /(obgyn|מייל|לידה|הריון|pregnancy)/i, summary: 'תיק מיילדות וגינקולוגיה' },
];
const sanitizeText = (value) => {
    return value
        .replace(/[0-9]/g, '')
        .replace(/[^א-תa-zA-Z\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
};
const generateCaseTopicSummary = (title, data) => {
    const dataSummary = data && typeof data === 'object' && data !== null && 'summary' in data
        ? String(data.summary ?? '')
        : '';
    const source = `${title ?? ''} ${dataSummary ?? ''}`;
    const sanitized = sanitizeText(source);
    const category = CATEGORY_MAP.find((entry) => entry.regex.test(sanitized));
    if (category)
        return category.summary;
    if (sanitized.length >= 6) {
        return sanitized.slice(0, 60);
    }
    return 'תיק רפואי משפטי';
};
exports.generateCaseTopicSummary = generateCaseTopicSummary;
const addDays = (date, days) => {
    const value = new Date(date);
    value.setDate(value.getDate() + days);
    return value;
};
exports.addDays = addDays;
const calculateDaysRemaining = (expiresAt, reference = new Date()) => {
    const diff = expiresAt.getTime() - reference.getTime();
    if (diff <= 0)
        return 0;
    return Math.ceil(diff / MS_IN_DAY);
};
exports.calculateDaysRemaining = calculateDaysRemaining;
const buildOwnerCaseResponse = (record, viewerId) => ({
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
    daysRemaining: (0, exports.calculateDaysRemaining)(record.retentionExpiresAt),
    ownerUserId: record.ownerId,
    isOwner: record.ownerId === viewerId,
});
exports.buildOwnerCaseResponse = buildOwnerCaseResponse;
const buildPublicCaseResponse = (record, viewerId) => ({
    id: record.id,
    title: record.title,
    topicSummary: record.topicSummary,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    daysRemaining: (0, exports.calculateDaysRemaining)(record.retentionExpiresAt),
    ownerUserId: record.ownerId,
    isOwner: record.ownerId === viewerId,
});
exports.buildPublicCaseResponse = buildPublicCaseResponse;
const extractLinkedKnowledgeIds = (record) => {
    if (!record.data || typeof record.data !== 'object')
        return [];
    const payload = record.data;
    const possibleKeys = ['knowledgeDocumentIds', 'documents', 'medicalDocs'];
    for (const key of possibleKeys) {
        const value = payload[key];
        if (Array.isArray(value)) {
            return value.filter((entry) => typeof entry === 'string');
        }
    }
    return [];
};
const hashValue = (value) => {
    return crypto_1.default.createHash('sha256').update(value).digest('hex');
};
const deleteCaseAndAssets = async (record, options = {}) => {
    const linkedKnowledgeIds = extractLinkedKnowledgeIds(record);
    const docIds = new Set(linkedKnowledgeIds);
    if (docIds.size > 0) {
        await prisma_1.prisma.literatureResource.deleteMany({
            where: { knowledgeId: { in: Array.from(docIds) } },
        });
        await prisma_1.prisma.knowledgeDocument.deleteMany({
            where: { id: { in: Array.from(docIds) } },
        });
    }
    await prisma_1.prisma.notification.deleteMany({
        where: { caseId: record.id },
    });
    await prisma_1.prisma.case.delete({ where: { id: record.id } });
    if (options.logRetention) {
        await (0, auditLogger_1.logAuditEvent)({
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
exports.deleteCaseAndAssets = deleteCaseAndAssets;
