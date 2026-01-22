"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runImapIngestionCycle = void 0;
const imapflow_1 = require("imapflow");
const mailparser_1 = require("mailparser");
const uuid_1 = require("uuid");
const env_1 = require("./env");
const prisma_1 = require("./prisma");
const storageClient_1 = require("./storageClient");
const documentClassifier_1 = require("./documentClassifier");
const textExtraction_1 = require("./textExtraction");
const summaryUtils_1 = require("./summaryUtils");
const isSupportedAttachment = (filename, contentType) => {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.pdf') || lower.endsWith('.docx') || lower.endsWith('.doc'))
        return true;
    if (!contentType)
        return false;
    return (contentType === 'application/pdf' ||
        contentType === 'application/msword' ||
        contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
};
const normalizeEmail = (value) => (value ?? '').trim().toLowerCase();
const getFromAddress = (parsed) => {
    const from = parsed?.from?.value?.[0]?.address;
    return typeof from === 'string' ? from : '';
};
const collectAttachments = (parsed) => {
    const attachments = Array.isArray(parsed?.attachments) ? parsed.attachments : [];
    return attachments
        .map((att) => ({
        filename: att?.filename || 'attachment',
        contentType: att?.contentType,
        content: Buffer.isBuffer(att?.content) ? att.content : Buffer.from(att?.content ?? ''),
    }))
        .filter((att) => Boolean(att.filename && att.content?.length));
};
const runImapIngestionCycle = async () => {
    const mailbox = env_1.config.imap.mailbox;
    if (!env_1.config.imap.enabled) {
        return { mailbox, fetched: 0, processed: 0, skipped: 0, lastUid: BigInt(0) };
    }
    if (!env_1.config.imap.host || !env_1.config.imap.user || !env_1.config.imap.password) {
        throw new Error('imap_config_missing');
    }
    const state = (await prisma_1.prisma.emailIngestionState.findUnique({ where: { mailbox } })) ??
        (await prisma_1.prisma.emailIngestionState.create({ data: { mailbox, lastUid: BigInt(0) } }));
    const client = new imapflow_1.ImapFlow({
        host: env_1.config.imap.host,
        port: env_1.config.imap.port,
        secure: env_1.config.imap.secure,
        auth: { user: env_1.config.imap.user, pass: env_1.config.imap.password },
        logger: false,
    });
    let fetched = 0;
    let processed = 0;
    let skipped = 0;
    let maxUid = state.lastUid ?? BigInt(0);
    await client.connect();
    try {
        await client.mailboxOpen(mailbox);
        // Default category for incoming judgments
        const defaultCategory = await prisma_1.prisma.category.upsert({
            where: { name: 'פסקי דין' },
            update: {},
            create: { name: 'פסקי דין' },
        });
        const fromFilter = normalizeEmail(env_1.config.imap.fromFilter);
        const startUid = (state.lastUid ?? BigInt(0)) + BigInt(1);
        const uidRange = `${startUid.toString()}:*`;
        for await (const msg of client.fetch({ uid: uidRange }, { uid: true, envelope: true, source: true, internalDate: true })) {
            fetched += 1;
            const uid = BigInt(msg.uid ?? 0);
            if (uid > maxUid)
                maxUid = uid;
            const sourceBuffer = msg.source;
            if (!sourceBuffer) {
                skipped += 1;
                continue;
            }
            const parsed = await (0, mailparser_1.simpleParser)(sourceBuffer);
            const from = normalizeEmail(getFromAddress(parsed));
            if (fromFilter && from !== fromFilter) {
                skipped += 1;
                continue;
            }
            const emailSubject = typeof parsed.subject === 'string' ? parsed.subject : '';
            const emailDate = parsed.date instanceof Date ? parsed.date : msg.internalDate ?? null;
            const emailMessageId = typeof parsed.messageId === 'string' ? parsed.messageId : `uid-${uid.toString()}`;
            const bodyText = (parsed.text ?? '').toString();
            const bodySummary = (0, summaryUtils_1.extractSummaryFromEmailBody)(bodyText);
            const attachments = collectAttachments(parsed).filter((att) => isSupportedAttachment(att.filename, att.contentType));
            if (!attachments.length) {
                // still advance UID so we don't loop forever on non-attachment emails
                skipped += 1;
                continue;
            }
            let attachmentIndex = 0;
            for (const attachment of attachments) {
                attachmentIndex += 1;
                const perAttachmentMessageId = `${emailMessageId}#${attachmentIndex}`;
                const exists = await prisma_1.prisma.document.findUnique({
                    where: { emailMessageId: perAttachmentMessageId },
                });
                if (exists) {
                    skipped += 1;
                    continue;
                }
                const attachmentUrl = await (0, storageClient_1.uploadFileToStorage)(attachment.content, attachment.filename, attachment.contentType ?? 'application/octet-stream');
                let content = '';
                try {
                    content = await (0, textExtraction_1.extractTextFromAttachment)(attachment.content, attachment.filename, attachment.contentType);
                }
                catch {
                    content = '';
                }
                const summary = bodySummary?.trim() ? bodySummary.trim() : (0, summaryUtils_1.summarizeFromText)(content);
                const classifierInput = `${emailSubject}\n${summary}\n${content}`.slice(0, 20000);
                const { topics, keywords } = (0, documentClassifier_1.classifyText)(classifierInput);
                await prisma_1.prisma.document.create({
                    data: {
                        id: (0, uuid_1.v4)(),
                        title: emailSubject || attachment.filename,
                        summary: summary ?? '',
                        content: content ? content.slice(0, 100_000) : null,
                        categoryId: defaultCategory.id,
                        keywords,
                        topics,
                        source: 'EMAIL',
                        emailFrom: from,
                        emailSubject,
                        emailDate: emailDate ?? null,
                        emailMessageId: perAttachmentMessageId,
                        attachmentUrl,
                        attachmentMime: attachment.contentType ?? null,
                    },
                });
                processed += 1;
            }
        }
        await prisma_1.prisma.emailIngestionState.update({
            where: { mailbox },
            data: { lastUid: maxUid },
        });
    }
    finally {
        await client.logout().catch(() => undefined);
    }
    return { mailbox, fetched, processed, skipped, lastUid: maxUid };
};
exports.runImapIngestionCycle = runImapIngestionCycle;
