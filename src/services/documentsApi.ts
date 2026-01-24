import { apiRequest, authFetch } from './api';
import { CategoryRecord, DocumentRecord, DocumentSourceKey } from '../types';

export interface SearchDocumentsParams {
  q?: string;
  categoryId?: string;
  categoryName?: string;
  source?: DocumentSourceKey;
  from?: string; // ISO
  to?: string; // ISO
  limit?: number;
  offset?: number;
}

export interface SearchDocumentsResponse {
  documents: DocumentRecord[];
  pagination: { limit: number; offset: number; total: number };
}

export const searchDocuments = async (params: SearchDocumentsParams = {}): Promise<SearchDocumentsResponse> => {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.categoryId) query.set('categoryId', params.categoryId);
  if (params.categoryName) query.set('categoryName', params.categoryName);
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
  categoryId?: string;
  categoryName?: string;
  summary?: string;
  file: File;
}

export const uploadDocument = async (input: UploadDocumentInput): Promise<DocumentRecord> => {
  const formData = new FormData();
  formData.append('title', input.title);
  if (input.categoryId) formData.append('categoryId', input.categoryId);
  if (input.categoryName) formData.append('categoryName', input.categoryName);
  if (input.summary) formData.append('summary', input.summary);
  formData.append('file', input.file);

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


