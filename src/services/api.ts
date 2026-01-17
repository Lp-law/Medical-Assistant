import { CaseData, CaseRecord, CaseSummaryRecord, IngestedDocument, NotificationRecord } from '../types';

export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000/api';

interface UploadChapterOptions {
  docType?: 'chapter' | 'precedent';
  tags?: string[];
  metadata?: Record<string, unknown>;
}

let authToken: string | null = null;

export const setAuthToken = (token: string | null): void => {
  authToken = token;
};

const withAuth = (init?: RequestInit): RequestInit => {
  const headers = new Headers(init?.headers || {});
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  return {
    ...init,
    headers,
  };
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, withAuth(init));
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || 'request_failed');
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
};

export { request as apiRequest };

export const isApiConfigured = (): boolean => Boolean(API_BASE_URL);

export const uploadChapterPdf = async (file: File, options: UploadChapterOptions = {}): Promise<IngestedDocument> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('docType', options.docType ?? 'chapter');
  if (options.tags?.length) {
    formData.append('tags', options.tags.join(','));
  }
  if (options.metadata) {
    formData.append('metadata', JSON.stringify(options.metadata));
  }

  const response = await fetch(`${API_BASE_URL}/ingest/pdf`, withAuth({ method: 'POST', body: formData }));

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'api-upload-failed');
  }

  const data = (await response.json()) as IngestedDocument;
  return data;
};

export interface CaseListResponse {
  ownCases: CaseRecord[];
  otherCases: CaseSummaryRecord[];
}

export const listCases = async (): Promise<CaseListResponse> => {
  const payload = await request<CaseListResponse>('/cases', { method: 'GET' });
  return {
    ownCases: payload.ownCases ?? [],
    otherCases: payload.otherCases ?? [],
  };
};

export const createCase = async (data: { title: string; data: CaseData }): Promise<CaseRecord> => {
  const payload = await request<{ case: CaseRecord }>('/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return payload.case;
};

export const getCase = async (id: string): Promise<CaseRecord> => {
  const payload = await request<{ case: CaseRecord }>(`/cases/${id}`, { method: 'GET' });
  return payload.case;
};

export const updateCase = async (
  id: string,
  data: { title?: string; data?: CaseData },
): Promise<CaseRecord> => {
  const payload = await request<{ case: CaseRecord }>(`/cases/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return payload.case;
};

export const updateCaseMetadata = async (id: string, data: { title?: string; topicSummary?: string }): Promise<CaseRecord> => {
  const payload = await request<{ case: CaseRecord }>(`/cases/${id}/metadata`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return payload.case;
};

export const archiveCase = async (id: string): Promise<CaseRecord> => {
  const payload = await request<{ case: CaseRecord }>(`/cases/${id}/archive`, { method: 'POST' });
  return payload.case;
};

export const renewCase = async (id: string): Promise<CaseRecord> => {
  const payload = await request<{ case: CaseRecord }>(`/cases/${id}/renew`, { method: 'POST' });
  return payload.case;
};

export const deleteCase = async (id: string): Promise<void> => {
  await request<void>(`/cases/${id}`, { method: 'DELETE' });
};

export const exportCaseFile = async (id: string, format: 'pdf' | 'json'): Promise<Blob> => {
  const response = await fetch(`${API_BASE_URL}/cases/${id}/export`, withAuth({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format }),
  }));
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'export_failed');
  }
  return response.blob();
};

export const listNotifications = async (): Promise<NotificationRecord[]> => {
  const payload = await request<{ notifications: NotificationRecord[] }>('/notifications', { method: 'GET' });
  return payload.notifications ?? [];
};

export const markNotificationRead = async (id: string): Promise<void> => {
  await request<void>(`/notifications/${id}/read`, { method: 'POST' });
};
