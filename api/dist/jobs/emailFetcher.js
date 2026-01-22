"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startEmailFetcherJobs = exports.runEmailFetcherOnce = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const imapProcessor_1 = require("../services/imapProcessor");
const env_1 = require("../services/env");
const runEmailFetcherOnce = async () => {
    if (!env_1.config.imap.enabled) {
        return { mailbox: env_1.config.imap.mailbox, fetched: 0, processed: 0, skipped: 0, lastUid: BigInt(0) };
    }
    return await (0, imapProcessor_1.runImapIngestionCycle)();
};
exports.runEmailFetcherOnce = runEmailFetcherOnce;
const startEmailFetcherJobs = () => {
    if (!env_1.config.imap.enabled) {
        return;
    }
    console.log('[emailFetcher] IMAP ingestion enabled. Scheduling every 10 minutes.');
    // Every 10 minutes
    node_cron_1.default.schedule('*/10 * * * *', () => {
        (0, exports.runEmailFetcherOnce)().catch((error) => console.error('[emailFetcher] failed', error));
    }, { timezone: 'UTC' });
};
exports.startEmailFetcherJobs = startEmailFetcherJobs;
