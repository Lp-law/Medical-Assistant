import { apiRequest } from './api';
import { LiteratureResource } from '../types';

export const searchLiterature = async (knowledgeId: string): Promise<LiteratureResource[]> => {
  const payload = await apiRequest<{ resources: LiteratureResource[] }>('/literature/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ knowledgeId }),
  });
  return payload.resources ?? [];
};

export const downloadLiterature = async (knowledgeId: string, ids?: string[]): Promise<void> => {
  await apiRequest('/literature/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ knowledgeId, ids }),
  });
};

export const summarizeLiterature = async (knowledgeId: string, ids?: string[]): Promise<void> => {
  await apiRequest('/literature/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ knowledgeId, ids }),
  });
};

export const listLiterature = async (knowledgeId: string): Promise<LiteratureResource[]> => {
  const payload = await apiRequest<{ resources: LiteratureResource[] }>(
    `/literature/list?knowledgeId=${encodeURIComponent(knowledgeId)}`,
    { method: 'GET' },
  );
  return payload.resources ?? [];
};

