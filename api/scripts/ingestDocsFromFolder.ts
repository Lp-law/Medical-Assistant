/**
 * Ingest documents from a folder into Document table.
 *
 * Required ENV:
 * - INGEST_FOLDER
 * - INGEST_CATEGORY: "פסיקה" | "ספרים" | "מאמרים"
 * - INGEST_DOCTYPE: e.g. "פסק דין" | "ספר" | "מאמר"
 *
 * Optional:
 * - BOOK_NAME (required when INGEST_CATEGORY == "ספרים")
 *
 * Run from api folder:
 *   npm run ingest-folder
 */

import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';
import { PrismaClient } from '@prisma/client';
import { v4 as uuid } from 'uuid';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require('pdf-parse');

const MAX_CONTENT_LENGTH = 100_000;
const MAX_SUMMARY_LENGTH = 500;
const MIN_CHARS_PER_PAGE_FOR_OCR_FALLBACK = 80;

const ALLOWED_CATEGORIES = ['פסיקה', 'ספרים', 'מאמרים'] as const;
type AllowedCategory = (typeof ALLOWED_CATEGORIES)[number];

const normalizeText = (text: string): string => text.replace(/\s+/g, ' ').trim();

async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  const raw = (data?.text ?? '') as string;
  const text = normalizeText(raw);
  const numPages = (data?.numpages as number) ?? 1;

  if (text.length < numPages * MIN_CHARS_PER_PAGE_FOR_OCR_FALLBACK) {
    try {
      const { analyzeWithAzureOcr } = await import('../src/services/ocrClient');
      const ocrText = await analyzeWithAzureOcr(buffer);
      if (ocrText && normalizeText(ocrText).length > text.length) {
        return normalizeText(ocrText);
      }
    } catch {
      // Azure OCR not configured or failed; keep pdf-parse output
    }
  }

  return text;
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return normalizeText(result.value ?? '');
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`missing_env_${name}`);
  }
  return value;
}

function ensureDatabaseUrl(): void {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    console.error('שגיאה: DATABASE_URL חסר. נא להגדיר אותו בקובץ api/.env או ב-ENV של המערכת.');
    console.error('Error: DATABASE_URL is missing. Set it in api/.env or process environment.');
    process.exit(1);
  }
  try {
    const parsed = new URL(raw);
    const dbName = parsed.pathname.replace(/^\//, '') || 'unknown_db';
    const host = parsed.hostname || 'unknown_host';
    console.log(`DB target loaded: ${host}/${dbName}`);
  } catch {
    // Keep going; Prisma will validate exact DSN format.
    console.log('DB target loaded.');
  }
}

async function main(): Promise<void> {
  try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  } catch {
    // optional
  }
  ensureDatabaseUrl();

  const folderPath = getRequiredEnv('INGEST_FOLDER');
  const ingestCategoryRaw = getRequiredEnv('INGEST_CATEGORY');
  const ingestDocType = getRequiredEnv('INGEST_DOCTYPE');

  if (!ALLOWED_CATEGORIES.includes(ingestCategoryRaw as AllowedCategory)) {
    throw new Error('invalid_INGEST_CATEGORY');
  }
  const ingestCategory = ingestCategoryRaw as AllowedCategory;
  const bookName = process.env.BOOK_NAME?.trim() || '';
  if (ingestCategory === 'ספרים' && !bookName) {
    throw new Error('missing_env_BOOK_NAME_for_books');
  }

  if (!fs.existsSync(folderPath)) {
    throw new Error(`folder_not_found: ${folderPath}`);
  }

  const entries = fs.readdirSync(folderPath, { withFileTypes: true, encoding: 'utf-8' });
  const files = entries.filter((e) => e.isFile() && /\.(pdf|docx)$/i.test(e.name));
  if (files.length === 0) {
    console.log('לא נמצאו קבצי PDF/DOCX בתיקייה.');
    return;
  }

  const prisma = new PrismaClient();
  let added = 0;
  let skipped = 0;
  let failed = 0;

  try {
    let categoryId: string;
    const existingCategory = await prisma.category.findUnique({ where: { name: ingestCategory } });
    if (existingCategory) {
      categoryId = existingCategory.id;
    } else {
      const createdCategory = await prisma.category.create({ data: { name: ingestCategory } });
      categoryId = createdCategory.id;
    }

    for (const entry of files) {
      const filePath = path.join(folderPath, entry.name);
      const title = entry.name.replace(/\.(pdf|docx)$/i, '').trim();
      if (!title) {
        console.log('נכשל:', entry.name, '(שם קובץ לא תקין)');
        failed += 1;
        continue;
      }

      try {
        const duplicate = ingestCategory === 'ספרים'
          ? await prisma.document.findFirst({
              where: {
                bookName,
                bookChapter: title,
              },
              select: { id: true },
            })
          : await prisma.document.findFirst({
              where: {
                title,
                categoryId,
              },
              select: { id: true },
            });

        if (duplicate) {
          console.log('דולג:', title);
          skipped += 1;
          continue;
        }

        const buffer = fs.readFileSync(filePath);
        let content = '';
        if (/\.pdf$/i.test(entry.name)) {
          content = await extractPdfText(buffer);
        } else if (/\.docx$/i.test(entry.name)) {
          content = await extractDocxText(buffer);
        }

        const contentTrimmed = content ? normalizeText(content) : '';
        const summary = (contentTrimmed.slice(0, MAX_SUMMARY_LENGTH).trim() || title).slice(0, MAX_SUMMARY_LENGTH);
        const contentForDb = contentTrimmed
          ? (contentTrimmed.length > MAX_CONTENT_LENGTH ? contentTrimmed.slice(0, MAX_CONTENT_LENGTH) : contentTrimmed)
          : null;

        await prisma.document.create({
          data: {
            id: uuid(),
            title,
            summary,
            content: contentForDb,
            categoryId,
            keywords: [],
            topics: [],
            source: 'MANUAL',
            docType: ingestDocType,
            bookName: ingestCategory === 'ספרים' ? bookName : null,
            bookChapter: ingestCategory === 'ספרים' ? title : null,
            articleTitle: ingestCategory === 'מאמרים' ? title : null,
            articleAuthor: ingestCategory === 'מאמרים' ? null : null,
          },
        });

        console.log('נוסף:', title);
        added += 1;
      } catch (error) {
        console.log('נכשל:', title, error);
        failed += 1;
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(`סיום: נוספו ${added}, דולגו ${skipped}, נכשלו ${failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
