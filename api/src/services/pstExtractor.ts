import * as PSTExtractor from 'pst-extractor';
import { simpleParser } from 'mailparser';

export interface ExtractedEmail {
  subject: string;
  from: string;
  to: string;
  date: Date | null;
  bodyText: string;
  bodyHtml: string | null;
  attachments: Array<{
    filename: string;
    contentType: string;
    content: Buffer;
  }>;
  messageId: string;
}

/**
 * Extract all emails from a PST file
 */
export const extractEmailsFromPst = async (pstBuffer: Buffer): Promise<ExtractedEmail[]> => {
  const pst = new PSTExtractor.PSTFile(pstBuffer);
  const emails: ExtractedEmail[] = [];

  const processFolder = (folder: PSTExtractor.PSTFolder): void => {
    // Process messages in this folder
    if (folder.hasSubfolders) {
      const childFolders = folder.getSubFolders();
      for (let i = 0; i < childFolders.length; i++) {
        processFolder(childFolders[i]);
      }
    }

    // Process messages - use contentCount and iterate
    const messageCount = folder.contentCount || 0;
    for (let i = 0; i < messageCount; i++) {
      try {
        // Try to get message - pst-extractor API may vary
        const msg = (folder as any).getMessage ? (folder as any).getMessage(i) : null;
        if (!msg || !(msg instanceof PSTExtractor.PSTMessage)) {
          continue;
        }

        try {
          const email = extractEmailFromMessage(msg);
          if (email) {
            emails.push(email);
          }
        } catch (error) {
          console.warn('[pstExtractor] failed to extract email from message', { error, subject: msg.subject });
        }
      } catch (error) {
        // Skip this message
        continue;
      }
    }
  };

  // Start from root folder
  const rootFolder = pst.getRootFolder();
  if (rootFolder) {
    processFolder(rootFolder);
  }

  return emails;
};

/**
 * Extract email data from a PST message
 */
const extractEmailFromMessage = (msg: PSTExtractor.PSTMessage): ExtractedEmail | null => {
  try {
    const subject = msg.subject || '';
    const from = msg.senderName || msg.senderEmailAddress || '';
    const to = msg.displayTo || msg.emailAddress || '';
    const date = msg.messageDeliveryTime;

    // Get body text
    let bodyText = msg.body || '';
    let bodyHtml: string | null = msg.bodyHTML || null;

    // If HTML exists but no plain text, extract text from HTML
    if (bodyHtml && !bodyText) {
      bodyText = bodyHtml
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // Extract attachments
    const attachments: Array<{ filename: string; contentType: string; content: Buffer }> = [];
    if (msg.hasAttachments) {
      const attachmentCount = msg.numberOfAttachments || 0;
      for (let i = 0; i < attachmentCount; i++) {
        try {
          const att = msg.getAttachment(i);
          if (!att) continue;

          const filename = att.filename || att.longFilename || `attachment_${i}`;
          try {
            // Read attachment content - pst-extractor API may vary
            const contentStream = (att as any).fileInputStream || (att as any).getFileInputStream?.();
            if (contentStream) {
              const chunks: Buffer[] = [];
              let chunk: any;
              while ((chunk = contentStream.read()) !== null && chunk !== undefined) {
                if (Buffer.isBuffer(chunk)) {
                  chunks.push(chunk);
                } else if (typeof chunk === 'number') {
                  // Single byte
                  chunks.push(Buffer.from([chunk]));
                }
              }
              const attachmentBuffer = chunks.length > 0 ? Buffer.concat(chunks) : Buffer.alloc(0);

            // Try to infer content type from filename
            const contentType = inferContentType(filename);

              attachments.push({
                filename,
                contentType,
                content: attachmentBuffer,
              });
            }
          } catch (streamError) {
            console.warn('[pstExtractor] failed to read attachment stream', { error: streamError, filename });
          }
        } catch (error) {
          console.warn('[pstExtractor] failed to extract attachment', { error, index: i });
        }
      }
    }

    // Generate message ID
    const messageId = msg.internetMessageId || `pst-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    return {
      subject,
      from,
      to,
      date: date ? new Date(date) : null,
      bodyText,
      bodyHtml,
      attachments,
      messageId,
    };
  } catch (error) {
    console.warn('[pstExtractor] failed to extract email from message', error);
    return null;
  }
};

/**
 * Infer content type from filename
 */
const inferContentType = (filename: string): string => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html';
  return 'application/octet-stream';
};

/**
 * Convert extracted email to EML format (RFC822)
 */
export const convertEmailToEml = (email: ExtractedEmail): string => {
  const lines: string[] = [];

  // Headers
  lines.push(`Message-ID: <${email.messageId}>`);
  lines.push(`From: ${email.from}`);
  lines.push(`To: ${email.to}`);
  lines.push(`Subject: ${email.subject}`);
  if (email.date) {
    lines.push(`Date: ${email.date.toUTCString()}`);
  }
  lines.push('MIME-Version: 1.0');

  // Body and attachments
  if (email.attachments.length > 0) {
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    lines.push('');

    // Body part
    lines.push(`--${boundary}`);
    if (email.bodyHtml) {
      lines.push('Content-Type: text/html; charset=utf-8');
      lines.push('Content-Transfer-Encoding: 8bit');
      lines.push('');
      lines.push(email.bodyHtml);
    } else {
      lines.push('Content-Type: text/plain; charset=utf-8');
      lines.push('Content-Transfer-Encoding: 8bit');
      lines.push('');
      lines.push(email.bodyText);
    }

    // Attachments
    for (const att of email.attachments) {
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: ${att.contentType}`);
      lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      lines.push(att.content.toString('base64'));
    }

    lines.push(`--${boundary}--`);
  } else {
    // No attachments - simple email
    if (email.bodyHtml) {
      lines.push('Content-Type: text/html; charset=utf-8');
      lines.push('Content-Transfer-Encoding: 8bit');
      lines.push('');
      lines.push(email.bodyHtml);
    } else {
      lines.push('Content-Type: text/plain; charset=utf-8');
      lines.push('Content-Transfer-Encoding: 8bit');
      lines.push('');
      lines.push(email.bodyText);
    }
  }

  return lines.join('\r\n');
};
