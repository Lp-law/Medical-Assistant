import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { v4 as uuid } from 'uuid';
import { config } from './env';
import { prisma } from './prisma';
import { uploadFileToStorage } from './storageClient';
import { classifyText } from './documentClassifier';
import { extractTextFromAttachment } from './textExtraction';
import { extractSummaryFromEmailBody, summarizeFromText } from './summaryUtils';

type AttachmentCandidate = {
  filename: string;
  contentType?: string;
  content: Buffer;
};

const isSupportedAttachment = (filename: string, contentType?: string): boolean => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf') || lower.endsWith('.docx') || lower.endsWith('.doc')) return true;
  if (!contentType) return false;
  return (
    contentType === 'application/pdf' ||
    contentType === 'application/msword' ||
    contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
};

const normalizeEmail = (value?: string): string => (value ?? '').trim().toLowerCase();

const getFromAddress = (parsed: any): string => {
  const from = parsed?.from?.value?.[0]?.address;
  return typeof from === 'string' ? from : '';
};

const collectAttachments = (parsed: any): AttachmentCandidate[] => {
  const attachments = Array.isArray(parsed?.attachments) ? parsed.attachments : [];
  return attachments
    .map((att: any) => ({
      filename: att?.filename || 'attachment',
      contentType: att?.contentType,
      content: Buffer.isBuffer(att?.content) ? att.content : Buffer.from(att?.content ?? ''),
    }))
    .filter((att: AttachmentCandidate) => Boolean(att.filename && att.content?.length));
};

export interface ImapCycleResult {
  mailbox: string;
  fetched: number;
  processed: number;
  skipped: number;
  lastUid: bigint;
}

export const runImapIngestionCycle = async (): Promise<ImapCycleResult> => {
  const mailbox = config.imap.mailbox;

  if (!config.imap.enabled) {
    return { mailbox, fetched: 0, processed: 0, skipped: 0, lastUid: BigInt(0) };
  }
  if (!config.imap.host || !config.imap.user || !config.imap.password) {
    throw new Error('imap_config_missing');
  }

  const state =
    (await prisma.emailIngestionState.findUnique({ where: { mailbox } })) ??
    (await prisma.emailIngestionState.create({ data: { mailbox, lastUid: BigInt(0) } }));

  const client = new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: config.imap.secure,
    auth: { user: config.imap.user, pass: config.imap.password },
    logger: false,
  });

  // imapflow emits 'error' events on the client; without a listener Node will crash the process.
  // Capture and log these errors, and let the request fail gracefully.
  let lastClientError: any = null;
  client.on('error', (err: Error) => {
    const e = err as any;
    lastClientError = e;
    console.error('[imap] client error event', {
      mailbox,
      errorName: e?.name,
      errorMessage: e?.message,
      errorCode: e?.code,
      response: e?.response,
      responseText: e?.responseText,
      executedCommand: e?.executedCommand,
      authenticationFailed: e?.authenticationFailed,
    });
  });

  let fetched = 0;
  let processed = 0;
  let skipped = 0;
  let maxUid = state.lastUid ?? BigInt(0);

  try {
    await client.connect();
  } catch (error: any) {
    console.error('[imap] connect failed', {
      host: config.imap.host,
      port: config.imap.port,
      secure: config.imap.secure,
      mailbox,
      errorName: error?.name,
      errorMessage: error?.message,
      errorCode: error?.code,
      response: error?.response,
      responseText: error?.responseText,
      executedCommand: error?.executedCommand,
      authenticationFailed: error?.authenticationFailed,
    });
    const authFailed =
      error?.authenticationFailed === true ||
      String(error?.responseText ?? '').toLowerCase().includes('authenticate failed') ||
      String(error?.response ?? '').toLowerCase().includes('authenticate failed');

    const e = new Error(authFailed ? 'imap_auth_failed' : 'imap_connect_failed');
    (e as any).cause = error;
    throw e;
  }
  try {
    try {
      await client.mailboxOpen(mailbox);
    } catch (error: any) {
      console.error('[imap] mailboxOpen failed', {
        mailbox,
        errorName: error?.name,
        errorMessage: error?.message,
        errorCode: error?.code,
      });
      const e = new Error('imap_mailbox_open_failed');
      (e as any).cause = error;
      throw e;
    }

    // Default category for incoming judgments
    const defaultCategory = await prisma.category.upsert({
      where: { name: 'פסקי דין' },
      update: {},
      create: { name: 'פסקי דין' },
    });

    const fromFilter = normalizeEmail(config.imap.fromFilter);
    const startUid = (state.lastUid ?? BigInt(0)) + BigInt(1);
    const uidRange = `${startUid.toString()}:*`;

    for await (const msg of client.fetch(
      { uid: uidRange },
      { uid: true, envelope: true, source: true, internalDate: true },
    )) {
      fetched += 1;
      const uid = BigInt(msg.uid ?? 0);
      if (uid > maxUid) maxUid = uid;

      const sourceBuffer = msg.source;
      if (!sourceBuffer) {
        skipped += 1;
        continue;
      }

      const parsed = await simpleParser(sourceBuffer as Buffer);
      const from = normalizeEmail(getFromAddress(parsed));
      if (fromFilter && from !== fromFilter) {
        skipped += 1;
        continue;
      }

      const emailSubject = typeof parsed.subject === 'string' ? parsed.subject : '';
      const emailDate = parsed.date instanceof Date ? parsed.date : msg.internalDate ?? null;
      const emailMessageId = typeof parsed.messageId === 'string' ? parsed.messageId : `uid-${uid.toString()}`;

      const bodyText = (parsed.text ?? '').toString();
      const bodySummary = extractSummaryFromEmailBody(bodyText);

      const attachments = collectAttachments(parsed).filter((att) =>
        isSupportedAttachment(att.filename, att.contentType),
      );

      if (!attachments.length) {
        // still advance UID so we don't loop forever on non-attachment emails
        skipped += 1;
        continue;
      }

      let attachmentIndex = 0;
      for (const attachment of attachments) {
        attachmentIndex += 1;
        const perAttachmentMessageId = `${emailMessageId}#${attachmentIndex}`;

        const exists = await prisma.document.findUnique({
          where: { emailMessageId: perAttachmentMessageId },
        });
        if (exists) {
          skipped += 1;
          continue;
        }

        const attachmentUrl = await uploadFileToStorage(
          attachment.content,
          attachment.filename,
          attachment.contentType ?? 'application/octet-stream',
        );

        let content = '';
        try {
          content = await extractTextFromAttachment(attachment.content, attachment.filename, attachment.contentType);
        } catch {
          content = '';
        }

        const summary = bodySummary?.trim() ? bodySummary.trim() : summarizeFromText(content);
        const classifierInput = `${emailSubject}\n${summary}\n${content}`.slice(0, 20000);
        const { topics, keywords } = classifyText(classifierInput);

        await prisma.document.create({
          data: {
            id: uuid(),
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

    await prisma.emailIngestionState.update({
      where: { mailbox },
      data: { lastUid: maxUid },
    });
  } finally {
    await client.logout().catch(() => undefined);
  }

  return { mailbox, fetched, processed, skipped, lastUid: maxUid };
};


