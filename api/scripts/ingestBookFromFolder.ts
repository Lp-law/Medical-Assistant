/**
 * טעינת פרקי ספר מתיקייה למאגר המסמכים (Document) כדי שהעוזר יוכל לחפש בהם.
 * הרצה: מהתיקייה api: npm run ingest-book
 * ברירת מחדל: content/books/תחשיבי-נזק (ביחס לשורש הפרויקט)
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { v4 as uuid } from 'uuid';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require('pdf-parse');

const BOOK_CATEGORY_NAME = 'תחשיבי נזק';
const BOOK_NAME = 'תחשיבי נזק';
const MAX_CONTENT_LENGTH = 100_000;
const MAX_SUMMARY_LENGTH = 500;

const MIN_CHARS_PER_PAGE_FOR_OCR_FALLBACK = 80;

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  const raw = (data?.text ?? '') as string;
  const text = raw.replace(/\s+/g, ' ').trim();
  const numPages = (data?.numpages as number) ?? 1;
  if (text.length < numPages * MIN_CHARS_PER_PAGE_FOR_OCR_FALLBACK) {
    try {
      const { analyzeWithAzureOcr } = await import('../src/services/ocrClient');
      const ocrText = await analyzeWithAzureOcr(buffer);
      if (ocrText && ocrText.trim().length > text.length) {
        return ocrText.replace(/\s+/g, ' ').trim();
      }
    } catch {
      // Azure OCR not configured or failed; keep pdf-parse result
    }
  }
  return text;
}

async function main() {
  const projectRoot = path.resolve(__dirname, '../..');
  const defaultFolder = path.join(projectRoot, 'content', 'books', 'תחשיבי-נזק');
  const folderPath = process.env.BOOK_FOLDER || defaultFolder;

  if (!fs.existsSync(folderPath)) {
    console.error('התיקייה לא נמצאה:', folderPath);
    process.exit(1);
  }

  const files = fs.readdirSync(folderPath, { withFileTypes: true, encoding: 'utf-8' });
  const pdfFiles = files.filter((f) => f.isFile() && f.name.toLowerCase().endsWith('.pdf'));
  if (pdfFiles.length === 0) {
    console.log('לא נמצאו קבצי PDF בתיקייה.');
    process.exit(0);
  }

  try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  } catch {
    // optional
  }
  const prisma = new PrismaClient();

  let categoryId: string;
  const existingCategory = await prisma.category.findUnique({ where: { name: BOOK_CATEGORY_NAME } });
  if (existingCategory) {
    categoryId = existingCategory.id;
    console.log('משתמשים בקטגוריה קיימת:', BOOK_CATEGORY_NAME);
  } else {
    const created = await prisma.category.create({ data: { name: BOOK_CATEGORY_NAME } });
    categoryId = created.id;
    console.log('נוצרה קטגוריה:', BOOK_CATEGORY_NAME);
  }

  let done = 0;
  let skipped = 0;
  for (const f of pdfFiles) {
    const filePath = path.join(folderPath, f.name);
    const title = f.name.replace(/\.pdf$/i, '').trim();
    if (!title) continue;

    const existing = await prisma.document.findFirst({
      where: { title, bookName: BOOK_NAME },
    });
    if (existing) {
      console.log('דולג (כבר קיים):', title);
      skipped += 1;
      continue;
    }

    let buffer: Buffer;
    try {
      buffer = fs.readFileSync(filePath);
    } catch (e) {
      console.warn('שגיאה בקריאת קובץ:', f.name, e);
      continue;
    }

    let content: string;
    try {
      content = await extractTextFromPdf(buffer);
    } catch (e) {
      console.warn('שגיאה בחילוץ טקסט:', f.name, e);
      content = '';
    }

    const summary = content.slice(0, MAX_SUMMARY_LENGTH).trim();
    const contentTruncated = content.length > MAX_CONTENT_LENGTH ? content.slice(0, MAX_CONTENT_LENGTH) : content;

    await prisma.document.create({
      data: {
        id: uuid(),
        title,
        summary: summary || title,
        content: contentTruncated || null,
        categoryId,
        keywords: [],
        topics: [],
        source: 'MANUAL',
        docType: 'ספר',
        bookName: BOOK_NAME,
        bookChapter: title,
      },
    });
    done += 1;
    console.log('נוסף:', title);
  }

  await prisma.$disconnect();
  console.log('סיום: נוספו', done, 'מסמכים, דולגו', skipped);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
