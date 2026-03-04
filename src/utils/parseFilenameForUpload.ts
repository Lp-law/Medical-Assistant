import type { DocumentTypeKey } from '../types';

const DOC_TYPES: DocumentTypeKey[] = ['פסק דין', 'חוות דעת', 'תחשיב נזק', 'סיכומים', 'מאמר', 'ספר'];

/** Types for which "תחום" (field) is relevant: פסק דין, חוות דעת, תחשיב נזק, סיכומים. Not מאמר/ספר. */
const FIELD_RELEVANT_TYPES: DocumentTypeKey[] = ['פסק דין', 'חוות דעת', 'תחשיב נזק', 'סיכומים'];

/**
 * Parses a filename (without extension) to suggest document metadata.
 * Convention: parts separated by " - " or "-". First part = doc type (must match app categories).
 * - For פסק דין / תחשיב נזק / סיכומים: part[2] or part[1] = תחום (e.g. אורתופדיה).
 * - For חוות דעת: part[1] = מומחה, part[2] = תחום.
 * - For מאמר / ספר: no field; author/title etc. only.
 */
export interface ParsedFilenameMeta {
  docType?: DocumentTypeKey;
  field?: string;
  expertName?: string;
  articleAuthor?: string;
  articleTitle?: string;
  bookAuthor?: string;
  bookName?: string;
  bookChapter?: string;
}

function trim(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function matchDocType(segment: string): DocumentTypeKey | undefined {
  const t = trim(segment);
  const exact = DOC_TYPES.find((d) => d === t);
  if (exact) return exact;
  return DOC_TYPES.find((d) => t.includes(d) || d.includes(t)) ?? undefined;
}

function isValidFieldValue(s: string): boolean {
  const t = trim(s);
  if (!t) return false;
  if (/^\d{4}$/.test(t)) return false; // year
  return true;
}

export function parseFilenameForUpload(filenameWithoutExtension: string): ParsedFilenameMeta {
  const raw = (filenameWithoutExtension ?? '').trim();
  if (!raw) return {};

  let parts = raw.split(/\s*-\s*/).map((p) => trim(p)).filter(Boolean);
  if (parts.length <= 1) {
    parts = raw.split('-').map((p) => trim(p)).filter(Boolean);
  }

  if (parts.length === 0) return {};

  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const docType = matchDocType(first);
  const result: ParsedFilenameMeta = {};

  if (docType) result.docType = docType;

  // תחום (field) only for פסק דין, חוות דעת, תחשיב נזק, סיכומים – not for מאמר/ספר
  if (docType && FIELD_RELEVANT_TYPES.includes(docType) && parts.length >= 2) {
    const fieldCandidate = parts.length >= 3 ? last : parts[1];
    if (fieldCandidate && fieldCandidate !== first && isValidFieldValue(fieldCandidate)) {
      result.field = fieldCandidate;
    }
  }

  // Middle part(s) by doc type
  if (parts.length >= 2) {
    const middle = parts.length === 2 ? parts[1] : parts.slice(1, -1).join(' - ');
    switch (docType) {
      case 'חוות דעת':
        // 2 parts: type - expert (no field). 3+ parts: type - expert - field
        result.expertName = parts.length >= 3 ? parts.slice(1, -1).join(' - ') : parts[1];
        break;
      case 'פסק דין':
      case 'תחשיב נזק':
      case 'סיכומים':
        // Only field is set above; no expert/author from filename for these
        break;
      case 'מאמר':
        result.articleAuthor = parts[1];
        if (parts.length >= 3) result.articleTitle = parts.slice(2).join(' - ');
        break;
      case 'ספר':
        result.bookAuthor = parts[1];
        if (parts.length >= 3) result.bookName = parts[2];
        if (parts.length >= 4) result.bookChapter = parts[3];
        break;
      default:
        break;
    }
  }

  return result;
}
