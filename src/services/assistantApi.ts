import { apiRequest } from './api';

export type AssistantDocumentHit = {
  id: string;
  title: string;
  summary: string;
  categoryName: string;
  source: string;
  attachmentUrl: string | null;
  createdAt: string;
};

export type AssistantSearchResponse = {
  queries: string[];
  documents: AssistantDocumentHit[];
};

export const assistantSearch = async (question: string, limit = 10): Promise<AssistantSearchResponse> => {
  return await apiRequest<AssistantSearchResponse>('/assistant/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, limit }),
  });
};


