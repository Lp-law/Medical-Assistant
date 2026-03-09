import { Router } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { prisma } from '../services/prisma';

const router = Router();
// גישה ציבורית – כפתור "תחשיבי נזק" מוצג גם בלי התחברות

const BOOK_NAME = 'תחשיבי נזק';
const BOOK_FOLDER_NAME = 'תחשיבי-נזק';

/** Project root (one level above api/) */
const getProjectRoot = (): string => path.resolve(__dirname, '../../..');
const getBookFolderPath = (): string =>
  path.join(getProjectRoot(), 'content', 'books', BOOK_FOLDER_NAME);
const sanitizeTitle = (raw: string): string => raw.replace(/\.\./g, '').replace(/[/\\]/g, '').trim();

const listFolderChapterTitles = async (): Promise<string[]> => {
  try {
    const files = await fs.readdir(getBookFolderPath(), { withFileTypes: true, encoding: 'utf-8' });
    return files
      .filter((f) => f.isFile() && f.name.toLowerCase().endsWith('.pdf'))
      .map((f) => f.name.replace(/\.pdf$/i, '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};

/**
 * GET /api/books/chapters
 * Returns list of chapters (documents) for the book "תחשיבי נזק".
 */
router.get('/chapters', async (_req, res) => {
  const dbList = await prisma.document.findMany({
    where: { bookName: BOOK_NAME },
    select: { id: true, title: true, bookChapter: true },
    orderBy: { title: 'asc' },
  });
  const chapters = dbList.map((d) => ({ id: d.id, title: d.title, bookChapter: d.bookChapter ?? d.title }));

  // Fallback: if not ingested yet, list chapters from the book folder itself
  const folderTitles = await listFolderChapterTitles();
  const knownTitles = new Set(chapters.map((c) => c.title));
  for (const title of folderTitles) {
    if (!knownTitles.has(title)) {
      chapters.push({ id: `fs:${title}`, title, bookChapter: title });
    }
  }

  chapters.sort((a, b) => a.title.localeCompare(b.title, 'he'));

  res.json({
    bookName: BOOK_NAME,
    chapters,
  });
});

/**
 * GET /api/books/chapters/:id/file
 * Serves the PDF file for the chapter. File is read from content/books/תחשיבי-נזק/{title}.pdf.
 * Only allows documents that belong to the book (bookName = 'תחשיבי נזק').
 */
router.get('/chapters/:id/file', async (req, res) => {
  const { id } = req.params;
  let chapterTitle = '';
  if (id.startsWith('fs:')) {
    chapterTitle = sanitizeTitle(id.slice(3));
  } else {
    const doc = await prisma.document.findFirst({
      where: { id, bookName: BOOK_NAME },
      select: { title: true },
    });
    if (!doc) {
      res.status(404).json({ error: 'chapter_not_found' });
      return;
    }
    chapterTitle = sanitizeTitle(doc.title);
  }
  if (!chapterTitle) {
    res.status(400).json({ error: 'invalid_chapter_title' });
    return;
  }
  const filePath = path.join(getBookFolderPath(), `${chapterTitle}.pdf`);
  try {
    await fs.access(filePath);
  } catch {
    res.status(404).json({ error: 'file_not_found', message: 'קובץ הפרק לא נמצא בשרת.' });
    return;
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(chapterTitle)}.pdf"`);
  createReadStream(filePath).pipe(res);
});

export const booksRouter = router;
