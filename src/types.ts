export type UserRole = 'admin' | 'attorney';

export type DocumentSourceKey = 'email' | 'manual';

export interface CategoryRecord {
  id: string;
  name: string;
}

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
  emailFrom?: string | null;
  emailSubject?: string | null;
  emailDate?: string | null;
  attachmentUrl?: string | null;
  attachmentMime?: string | null;
  createdAt: string;
  updatedAt: string;
}


