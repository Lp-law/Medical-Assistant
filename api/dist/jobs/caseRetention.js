"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCaseRetentionJobs = exports.runCaseRetentionCycle = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const client_1 = require("@prisma/client");
const prisma_1 = require("../services/prisma");
const caseLifecycle_1 = require("../services/caseLifecycle");
const notificationService_1 = require("../services/notificationService");
const DAYS = 24 * 60 * 60 * 1000;
const nowUtc = () => new Date();
const markCasesAsWarned = async (ids) => {
    if (!ids.length)
        return;
    await prisma_1.prisma.case.updateMany({
        where: { id: { in: ids } },
        data: { retentionWarningSent: true },
    });
};
const markCasesAsFinalWarned = async (ids) => {
    if (!ids.length)
        return;
    await prisma_1.prisma.case.updateMany({
        where: { id: { in: ids } },
        data: { retentionFinalWarningSent: true, status: client_1.CaseStatus.PENDING_DELETE },
    });
};
const runCaseRetentionCycle = async (referenceDate = nowUtc()) => {
    const warningDate = (0, caseLifecycle_1.addDays)(referenceDate, caseLifecycle_1.WARNING_THRESHOLD_DAYS);
    const finalWarningDate = (0, caseLifecycle_1.addDays)(referenceDate, caseLifecycle_1.FINAL_WARNING_THRESHOLD_DAYS);
    const warnCandidates = await prisma_1.prisma.case.findMany({
        where: {
            status: client_1.CaseStatus.ACTIVE,
            archivedAt: null,
            retentionWarningSent: false,
            retentionExpiresAt: { lte: warningDate },
        },
    });
    if (warnCandidates.length) {
        await Promise.all(warnCandidates.map(async (record) => {
            await (0, notificationService_1.createNotification)({
                userId: record.ownerId,
                type: 'CASE_RETENTION_WARNING',
                caseId: record.id,
                message: `התיק "${record.title}" יימחק בעוד ${(0, caseLifecycle_1.calculateDaysRemaining)(record.retentionExpiresAt, referenceDate)} ימים. מומלץ לייצא או לארכב.`,
                metadata: (0, caseLifecycle_1.buildPublicCaseResponse)(record, record.ownerId),
            });
        }));
        await markCasesAsWarned(warnCandidates.map((record) => record.id));
    }
    const finalWarningCandidates = await prisma_1.prisma.case.findMany({
        where: {
            status: { in: [client_1.CaseStatus.ACTIVE, client_1.CaseStatus.PENDING_DELETE] },
            archivedAt: null,
            retentionFinalWarningSent: false,
            retentionExpiresAt: { lte: finalWarningDate },
        },
    });
    if (finalWarningCandidates.length) {
        await Promise.all(finalWarningCandidates.map(async (record) => {
            await (0, notificationService_1.createNotification)({
                userId: record.ownerId,
                type: 'CASE_RETENTION_FINAL_WARNING',
                caseId: record.id,
                message: `התיק "${record.title}" יימחק בתוך שלושה ימים. אנא אשר מחיקה או תחדש את התיק.`,
                metadata: (0, caseLifecycle_1.buildPublicCaseResponse)(record, record.ownerId),
            });
        }));
        await markCasesAsFinalWarned(finalWarningCandidates.map((record) => record.id));
    }
    const expiredCases = await prisma_1.prisma.case.findMany({
        where: {
            status: { in: [client_1.CaseStatus.ACTIVE, client_1.CaseStatus.PENDING_DELETE] },
            archivedAt: null,
            retentionExpiresAt: { lte: referenceDate },
        },
    });
    for (const record of expiredCases) {
        await (0, caseLifecycle_1.deleteCaseAndAssets)(record, { logRetention: true });
        await (0, notificationService_1.createNotification)({
            userId: record.ownerId,
            type: 'CASE_RETENTION_PURGED',
            message: `התיק "${record.title}" הוסר מתוקף מדיניות השמירה.`,
        });
    }
};
exports.runCaseRetentionCycle = runCaseRetentionCycle;
const startCaseRetentionJobs = () => {
    node_cron_1.default.schedule('0 2 * * *', () => {
        (0, exports.runCaseRetentionCycle)().catch((error) => console.error('[retention] failed to run cycle', error));
    }, { timezone: 'UTC' });
};
exports.startCaseRetentionJobs = startCaseRetentionJobs;
