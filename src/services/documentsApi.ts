import { apiRequest, authFetch, API_BASE_URL, getAuthToken } from './api';
import { CategoryRecord, DocumentRecord, DocumentSourceKey, DocumentTypeKey } from '../types';

export const DOC_TYPES: DocumentTypeKey[] = ['פסק דין', 'חוות דעת', 'תחשיב נזק', 'סיכומים', 'מאמר', 'ספר'];

export const getFieldSuggestions = async (): Promise<string[]> => {
  const payload = await apiRequest<{ suggestions: string[] }>('/documents/field-suggestions', { method: 'GET' });
  return payload.suggestions ?? [];
};

export const getExpertSuggestions = async (): Promise<string[]> => {
  const payload = await apiRequest<{ suggestions: string[] }>('/documents/expert-suggestions', { method: 'GET' });
  return payload.suggestions ?? [];
};

export interface SearchDocumentsParams {
  q?: string;
  categoryId?: string;
  categoryName?: string;
  matchMode?: 'all' | 'any';
  phrase?: string;
  include?: string[];
  exclude?: string[];
  categories?: string[];
  fieldScope?: 'title' | 'title_summary' | 'all';
  source?: DocumentSourceKey;
  from?: string; // ISO
  to?: string; // ISO
  limit?: number;
  offset?: number;
}

export interface SearchDocumentsResponse {
  documents: DocumentRecord[];
  pagination: { limit: number; offset: number; total: number };
  normalizedQuery?: {
    q?: string;
    phrase?: string | null;
    include?: string[];
    exclude?: string[];
    tokens?: string[];
    matchMode?: 'all' | 'any';
    fieldScope?: 'title' | 'title_summary' | 'all';
    categories?: string[];
  };
}

export const searchDocuments = async (params: SearchDocumentsParams = {}): Promise<SearchDocumentsResponse> => {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.categoryId) query.set('categoryId', params.categoryId);
  if (params.categoryName) query.set('categoryName', params.categoryName);
  if (params.matchMode) query.set('matchMode', params.matchMode);
  if (params.phrase) query.set('phrase', params.phrase);
  if (params.include?.length) query.set('include', params.include.join(','));
  if (params.exclude?.length) query.set('exclude', params.exclude.join(','));
  if (params.categories?.length) query.set('categories', params.categories.join(','));
  if (params.fieldScope) query.set('fieldScope', params.fieldScope);
  if (params.source) query.set('source', params.source);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (typeof params.limit === 'number') query.set('limit', String(params.limit));
  if (typeof params.offset === 'number') query.set('offset', String(params.offset));

  const path = `/documents/search?${query.toString()}`;
  return await apiRequest<SearchDocumentsResponse>(path, { method: 'GET' });
};

export interface UploadDocumentInput {
  title: string;
  docType: DocumentTypeKey;
  categoryId?: string;
  categoryName?: string;
  field?: string;
  expertName?: string;
  articleAuthor?: string;
  articleTitle?: string;
  bookAuthor?: string;
  bookName?: string;
  bookChapter?: string;
  notes?: string;
  summary?: string;
  file: File;
  /** Optional: called with 0–100 during upload (uses XHR when provided). */
  onProgress?: (percent: number) => void;
}

export const uploadDocument = async (input: UploadDocumentInput): Promise<DocumentRecord> => {
  const formData = new FormData();
  formData.append('title', input.title);
  formData.append('docType', input.docType);
  if (input.categoryId) formData.append('categoryId', input.categoryId);
  if (input.categoryName) formData.append('categoryName', input.categoryName);
  if (input.field) formData.append('field', input.field);
  if (input.expertName) formData.append('expertName', input.expertName);
  if (input.articleAuthor) formData.append('articleAuthor', input.articleAuthor);
  if (input.articleTitle) formData.append('articleTitle', input.articleTitle);
  if (input.bookAuthor) formData.append('bookAuthor', input.bookAuthor);
  if (input.bookName) formData.append('bookName', input.bookName);
  if (input.bookChapter) formData.append('bookChapter', input.bookChapter);
  if (input.notes) formData.append('notes', input.notes);
  if (input.summary) formData.append('summary', input.summary ?? '');
  formData.append('file', input.file);

  if (typeof input.onProgress === 'function') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${API_BASE_URL}/documents/upload`;
      xhr.open('POST', url);
      xhr.withCredentials = true;
      const token = getAuthToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) input.onProgress!((100 * e.loaded) / e.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const payload = JSON.parse(xhr.responseText) as { document: DocumentRecord };
            input.onProgress?.(100);
            resolve(payload.document);
          } catch {
            reject(new Error('upload_failed'));
          }
        } else {
          reject(new Error(xhr.responseText || 'upload_failed'));
        }
      };
      xhr.onerror = () => reject(new Error('upload_failed'));
      xhr.send(formData);
    });
  }

  const response = await authFetch('/documents/upload', { method: 'POST', body: formData });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'upload_failed');
  }
  const payload = (await response.json()) as { document: DocumentRecord };
  return payload.document;
};

export interface UploadEmlResponse {
  documents: DocumentRecord[];
  attachmentsProcessed: number;
}

export const uploadEml = async (file: File): Promise<UploadEmlResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await authFetch('/documents/upload-eml', { method: 'POST', body: formData });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'upload_eml_failed');
  }
  return (await response.json()) as UploadEmlResponse;
};

export type UploadEmlBatchResultRow = {
  fileName: string;
  status: 'ok' | 'error';
  attachmentsProcessed?: number;
  documentsCreated?: number;
  error?: string;
};

export type UploadEmlBatchResponse = {
  filesProcessed: number;
  attachmentsProcessed: number;
  documentsCreated: number;
  results: UploadEmlBatchResultRow[];
};

export const uploadEmlBatch = async (files: File[]): Promise<UploadEmlBatchResponse> => {
  const formData = new FormData();
  for (const f of files) {
    formData.append('files', f);
  }
  const response = await authFetch('/documents/upload-eml-batch', { method: 'POST', body: formData });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'upload_eml_batch_failed');
  }
  return (await response.json()) as UploadEmlBatchResponse;
};

export interface UploadPstResponse {
  documents: DocumentRecord[];
  emailsProcessed: number;
  totalEmails: number;
  attachmentsProcessed: number;
  documentsCreated: number;
}

export const uploadPst = async (file: File): Promise<UploadPstResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await authFetch('/documents/upload-pst', { method: 'POST', body: formData });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'upload_pst_failed');
  }
  return (await response.json()) as UploadPstResponse;
};

export const deleteAllDocuments = async (): Promise<{ deleted: number }> => {
  const payload = await apiRequest<{ deleted: number }>('/admin/documents/all', { method: 'DELETE' });
  return payload;
};

export const listCategories = async (): Promise<CategoryRecord[]> => {
  const payload = await apiRequest<{ categories: CategoryRecord[] }>('/categories', { method: 'GET' });
  return payload.categories ?? [];
};

export const createCategory = async (name: string): Promise<CategoryRecord> => {
  const payload = await apiRequest<{ category: CategoryRecord }>('/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return payload.category;
};

export const updateDocumentTags = async (
  id: string,
  input: { topics: string[]; keywords: string[] },
): Promise<DocumentRecord> => {
  const payload = await apiRequest<{ document: DocumentRecord }>(`/documents/${encodeURIComponent(id)}/tags`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return payload.document;
};


