import { apiRequest } from './api';

export type AssistantDocumentHit = {
  id: string;
  title: string;
  summary: string;
  contentSnippet: string;
  categoryName: string;
  source: string;
  attachmentUrl: string | null;
  createdAt: string;
};

export type AssistantSearchResponse = {
  queries: string[];
  documents: AssistantDocumentHit[];
};

export const assistantSearch = async (
  question: string,
  input?: { limit?: number; categoryName?: string },
): Promise<AssistantSearchResponse> => {
  return await apiRequest<AssistantSearchResponse>('/assistant/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      limit: input?.limit ?? 10,
      categoryName: input?.categoryName,
    }),
  });
};


