import { apiRequest } from './api';
import {
  KnowledgeDocumentDetail,
  KnowledgeDocumentListResponse,
  KnowledgeDocumentSummary,
} from '../types';

interface ListParams {
  docType?: string;
  limit?: number;
  offset?: number;
}

const buildQuery = (params: ListParams): string => {
  const query = new URLSearchParams();
  if (params.docType) query.set('docType', params.docType);
  if (typeof params.limit === 'number') query.set('limit', String(params.limit));
  if (typeof params.offset === 'number') query.set('offset', String(params.offset));
  return query.toString();
};

export const listKnowledgeDocuments = async (params: ListParams = {}): Promise<KnowledgeDocumentSummary[]> => {
  const query = buildQuery(params);
  const path = query ? `/knowledge?${query}` : '/knowledge';
  const payload = await apiRequest<KnowledgeDocumentListResponse>(path, { method: 'GET' });
  return payload.documents ?? [];
};

export const getKnowledgeDocument = async (id: string): Promise<KnowledgeDocumentDetail> => {
  if (!id) {
    throw new Error('knowledge_id_required');
  }
  const payload = await apiRequest<{ document: KnowledgeDocumentDetail }>(`/knowledge/${id}`, { method: 'GET' });
  return payload.document;
};

