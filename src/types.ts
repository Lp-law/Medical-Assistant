export type UserRole = 'admin' | 'attorney';

export type DocumentSourceKey = 'email' | 'manual';

export interface CategoryRecord {
  id: string;
  name: string;
}

export type DocumentTypeKey = 'פסק דין' | 'חוות דעת' | 'תחשיב נזק' | 'סיכומים' | 'מאמר' | 'ספר';

export interface DocumentRecord {
  id: string;
  title: string;
  summary: string;
  content?: string | null;
  categoryId: string;
  category?: CategoryRecord;
  keywords: string[];
  topics: string[];
  source: 'EMAIL' | 'MANUAL';
  docType?: string | null;
  field?: string | null;
  expertName?: string | null;
  articleAuthor?: string | null;
  articleTitle?: string | null;
  bookAuthor?: string | null;
  bookName?: string | null;
  bookChapter?: string | null;
  notes?: string | null;
  emailFrom?: string | null;
  emailSubject?: string | null;
  emailDate?: string | null;
  attachmentUrl?: string | null;
  attachmentMime?: string | null;
  createdAt: string;
  updatedAt: string;
}


